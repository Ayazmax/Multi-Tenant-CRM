# Multi-Tenant CRM

A production-oriented, multi-tenant CRM built with **Django REST Framework**, **React (TypeScript)**, **PostgreSQL** and **AWS S3**.

Multiple organizations operate independently within the same system. Every user belongs to exactly one organization, and all data access is strictly scoped to that organization.

## Tech stack

| Layer    | Technology                                                                  |
|----------|-----------------------------------------------------------------------------|
| Backend  | Python 3, Django 6, Django REST Framework, SimpleJWT, django-filter, django-storages |
| Database | PostgreSQL                                                                  |
| Storage  | AWS S3 (private bucket, presigned URLs), local disk fallback for development |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router, Zustand, TanStack Query, Axios |
| Tests    | pytest, pytest-django (81 tests)                                            |

## Repository structure

```
backend/
  config/            settings (base / dev / prod / test), root URLs, /api/v1/ router
  apps/core/         tenant base models & managers, middleware, JWT auth, permissions,
                     response envelope, exception handler, pagination, base services & viewsets
  apps/accounts/     Organization, User (roles), auth endpoints, dashboard, seed_demo command
  apps/crm/          Company & Contact: models, serializers, services, filters, views
  apps/activity/     immutable ActivityLog, audit service, read-only API
  tests/             tenant isolation, RBAC, validation, soft delete, audit log
  requirements/      base.txt, dev.txt, prod.txt
frontend/
  src/api/           centralized Axios client (token refresh, error normalization) + endpoint modules
  src/store/         Zustand auth store (persisted session)
  src/hooks/         React Query hooks, permissions, list state (search/filter/sort/page)
  src/components/    reusable UI (DataTable, Pagination, Modal, ConfirmDialog, forms, badges, states)
  src/pages/         Login, Dashboard, Companies, Company detail (+ contacts), Activity log
  src/routes/        ProtectedRoute, PublicOnlyRoute, PermissionRoute
docs/aws/            IAM and bucket policies for S3
```

Each backend app keeps **models, serializers, services, permissions and views** separate. Views stay thin: they validate input through serializers and delegate writes to a service class, which owns business rules (tenant assignment, audit logging, cascading soft delete, file cleanup).

## Architecture

### Multi-tenancy (row-level, shared schema)

Every tenant-owned table (`Company`, `Contact`, `ActivityLog`) carries an `organization` foreign key. Isolation is enforced in several layers, so a single mistake does not leak data:

1. **Authentication binds the tenant.** `TenantJWTAuthentication` authenticates the JWT and attaches the user's organization to the request. The organization always comes from the database user, never from client input.
2. **Querysets are scoped by default.** `TenantScopedMixin.get_queryset()` filters every viewset by `request.organization`. `TenantManager.for_organization(None)` returns an empty queryset (fail closed).
3. **Writes are stamped server-side.** Services set `organization` on create; the field is not writable through any serializer.
4. **Foreign keys are validated within the tenant.** A contact can only be attached to a company of the same organization; the serializer's company queryset is scoped to the tenant.
5. **Cross-tenant access returns `404`**, not `403`, so the API does not reveal that a record exists in another organization. ID-based filters (`?company=`, `?user=`) are plain number filters for the same reason.

The test suite (`tests/test_tenant_isolation.py`) checks list, retrieve, update, delete, filtering and foreign-key assignment across two organizations.

### Roles & permissions

| Action                         | Staff | Manager | Admin |
|--------------------------------|:-----:|:-------:|:-----:|
| View companies / contacts      |  yes  |   yes   |  yes  |
| Create companies / contacts    |  yes  |   yes   |  yes  |
| Edit companies / contacts      |   -   |   yes   |  yes  |
| Delete companies / contacts    |   -   |    -    |  yes  |
| View activity log & team list  |   -   |   yes   |  yes  |

Staff get "limited write access": they can add records but cannot change or remove existing ones.

Enforced by the custom `RoleBasedPermission` class: each viewset declares a `role_permissions` map (action → allowed roles), and any action missing from the map is denied. The frontend mirrors this matrix (`src/lib/permissions.ts`) to hide buttons and routes, but the backend is the source of truth.

### Soft delete

`Company` and `Contact` have `is_deleted` / `deleted_at`. The default manager hides deleted rows, so they disappear from every API response while remaining in the database for audit. Deleting a company also soft-deletes its contacts, and each contact deletion gets its own activity log entry. Uniqueness rules (company name per organization, contact email per company) only apply to non-deleted rows, so a deleted record's name or email can be reused.

### Activity log

Every create, update and delete through the service layer writes an `ActivityLog` row with the user, action (`CREATE` / `UPDATE` / `DELETE`), model name, object ID, a readable object label, a field-level diff of changes, and a timestamp. Log rows are immutable: updating or deleting them raises an error, and the API and Django admin are read-only. Updates that change nothing are not logged. The user's email is stored as a snapshot so entries stay readable if the user is removed later.

### Consistent API responses

Every response, including errors, validation failures and 404s, uses one envelope:

```json
{
  "success": true,
  "message": "Request successful.",
  "data": { },
  "errors": null,
  "meta": { "pagination": { "count": 42, "page": 1, "page_size": 10, "total_pages": 5, "next": "...", "previous": null } }
}
```

This is implemented with a custom renderer, a custom exception handler (DRF and Django exceptions, plus unhandled errors that are logged and returned as a generic 500), and a custom paginator.

## AWS S3 storage strategy

Company logos go to S3 through `django-storages`.

- **Private bucket.** Block Public Access is fully enabled and objects are uploaded with no ACL. Nothing in the bucket is publicly readable.
- **Presigned URLs.** The API returns a time-limited (default 1 hour, `AWS_QUERYSTRING_EXPIRE`) SigV4 signed URL for each logo. Only authenticated users of the right organization receive a company's URL, because the company itself is tenant-scoped.
- **Tenant-prefixed, unguessable keys.** `media/org_<organization_id>/logos/<uuid>.<ext>`. Original filenames are never used, so there are no collisions or path tricks.
- **Least-privilege IAM.** The application user can only `PutObject`, `GetObject` and `DeleteObject` under `media/*` in one bucket ([`docs/aws/s3-iam-policy.json`](docs/aws/s3-iam-policy.json)). It cannot list or delete the bucket, or touch other buckets.
- **HTTPS only.** The bucket policy denies any request made without TLS ([`docs/aws/s3-bucket-policy.json`](docs/aws/s3-bucket-policy.json)).
- **No hardcoded credentials.** Keys are read from environment variables. If they are left empty, boto3 falls back to its default credential chain, so on AWS compute an attached IAM role can be used without any static keys (preferred in production).
- **Upload validation.** Only JPG, PNG and WEBP are accepted (SVG is rejected because it can carry scripts), up to 2 MB, and the file is verified as a real image by Pillow.
- **Cleanup.** When a logo is replaced or removed, the old object is deleted after the database transaction commits.

For local development, set `USE_S3=False` to store files under `backend/media/` with the same code path.

### S3 setup

1. Create a bucket (for example in `ap-south-1`) with **Block Public Access: all on** and **Object Ownership: bucket owner enforced**.
2. Apply `docs/aws/s3-bucket-policy.json` as the bucket policy, replacing `YOUR-BUCKET-NAME`.
3. Create an IAM user (or role) with the policy in `docs/aws/s3-iam-policy.json`, and create an access key for it.
4. In `backend/.env`: `USE_S3=True`, plus `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_REGION_NAME`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 14+

### 1. Database

```sql
CREATE ROLE crm_user WITH LOGIN PASSWORD 'your_password';
CREATE DATABASE crm_db OWNER crm_user;
```

(The test runner creates its own `test_crm_db`, so the role needs `CREATEDB` to run tests: `ALTER ROLE crm_user CREATEDB;`.)

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env        # then edit DJANGO_SECRET_KEY and DATABASE_URL
python manage.py migrate
python manage.py seed_demo  # optional demo data (use --reset to recreate)
python manage.py runserver 8000
```

Generate a secret key with `python -c "import secrets; print(secrets.token_urlsafe(50))"`.

> **Windows note:** if `runserver 8000` fails with "You don't have permission to access that port", Windows has reserved that port range (check with `netsh interface ipv4 show excludedportrange protocol=tcp`). Use another port, for example `runserver 8888`, and set `VITE_API_BASE_URL=http://localhost:8888/api/v1` in `frontend/.env`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev                 # http://localhost:5173
```

### Demo accounts

After `seed_demo`, all accounts use the password **`Demo@12345`**:

| Organization          | Admin              | Manager              | Staff              |
|-----------------------|--------------------|----------------------|--------------------|
| Acme Travels (Pro)    | `admin@acme.test`  | `manager@acme.test`  | `staff@acme.test`  |
| Globex Tours (Basic)  | `admin@globex.test`| `manager@globex.test`| `staff@globex.test`|

Log in as users from both organizations to see that their data never overlaps. The login page shows quick-fill buttons for these accounts in development builds only.

### Running tests

```bash
cd backend
pytest                 # uses config.settings.test (local file storage, fast hasher)
```

```bash
cd frontend
npm run lint
npm run build          # type-checks and builds
```

## Configuration

All configuration comes from environment variables. See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example). Real `.env` files are git-ignored.

| Settings module          | Used by                         | Notes |
|--------------------------|---------------------------------|-------|
| `config.settings.dev`    | `manage.py` (default)           | DEBUG on, browsable API, localhost CORS defaults |
| `config.settings.prod`   | `wsgi.py` / `asgi.py` (default) | DEBUG off, HSTS, SSL redirect, secure cookies; refuses to start without `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` |
| `config.settings.test`   | pytest                          | local storage, fast password hasher, relaxed throttling |

Production install: `pip install -r requirements/prod.txt` (adds gunicorn), `python manage.py collectstatic`, then run `gunicorn config.wsgi`.

CORS is restricted to the origins listed in `CORS_ALLOWED_ORIGINS`. Credentials (cookies) are not allowed because authentication uses bearer tokens.

## API reference

Base URL: `/api/v1/`. Every endpoint except login, refresh and health requires `Authorization: Bearer <access_token>`.

### Auth & organization

| Method | Endpoint          | Description |
|--------|-------------------|-------------|
| GET    | `health/`         | Health check (public) |
| POST   | `auth/login/`     | `{email, password}` → `{access, refresh, user}` (rate limited) |
| POST   | `auth/refresh/`   | `{refresh}` → new `{access, refresh}` (rotation + blacklist) |
| POST   | `auth/logout/`    | `{refresh}`: blacklists the refresh token |
| GET    | `auth/me/`        | Current user with organization and role |
| GET    | `dashboard/`      | Organization summary, counts, top industries, recent companies, recent activity (managers/admins) |
| GET    | `users/`          | Members of the organization (managers/admins) |

### Companies

| Method | Endpoint                     | Roles |
|--------|------------------------------|-------|
| GET    | `companies/`                 | all |
| POST   | `companies/`                 | all (multipart for `logo`) |
| GET    | `companies/{id}/`            | all |
| PATCH/PUT | `companies/{id}/`         | manager, admin (`remove_logo=true` clears the logo) |
| DELETE | `companies/{id}/`            | admin (soft delete, cascades to contacts) |
| GET    | `companies/filter-options/`  | all: distinct industries and countries for filter dropdowns |

Query parameters: `search` (name, industry, country), `industry`, `country`, `has_logo`, `created_from`, `created_to`, `ordering` (`name`, `industry`, `country`, `created_at`, `contacts_count`; prefix `-` for descending), `page`, `page_size` (max 100).

### Contacts

| Method | Endpoint           | Roles |
|--------|--------------------|-------|
| GET    | `contacts/`        | all |
| POST   | `contacts/`        | all |
| GET    | `contacts/{id}/`   | all |
| PATCH/PUT | `contacts/{id}/` | manager, admin |
| DELETE | `contacts/{id}/`   | admin (soft delete) |

Query parameters: `company`, `role`, `search` (name, email, phone, role, company name), `created_from`, `created_to`, `ordering`, `page`, `page_size`.

Validation: email is unique per company (case-insensitive); phone is optional, digits only, 8–15 characters.

### Activity log (read-only)

| Method | Endpoint                | Roles |
|--------|-------------------------|-------|
| GET    | `activity-logs/`        | manager, admin |
| GET    | `activity-logs/{id}/`   | manager, admin |

Query parameters: `action`, `model_name`, `object_id`, `user`, `date_from`, `date_to`, `search`, `ordering`, `page`, `page_size`.

## Frontend notes

- **Centralized API layer.** One Axios instance attaches the access token, unwraps the response envelope, and converts every failure into a typed `ApiError` with field errors. On a `401`, it runs a single shared refresh request (concurrent requests wait for it), retries the original request, and signs the user out if the refresh fails.
- **State management.** Zustand holds the auth session. TanStack Query holds server state, with cache invalidation after mutations, so lists, detail pages and the dashboard stay in sync.
- **Routing.** Protected routes redirect anonymous users to login. Role-restricted routes (Activity log) redirect users without permission. Search, filters, sort and page are stored in the URL query string, so views can be shared and survive a reload.
- **UX.** Skeleton and loading states, empty and error states with retry, toast notifications, confirmation before delete, client-side validation that matches the backend rules, and server field errors shown inline.

## Security notes & trade-offs

- JWT access tokens are short-lived (15 minutes). Refresh tokens rotate and are blacklisted on use and on logout.
- Tokens are kept in `localStorage` for simplicity. This is readable by JavaScript, so an XSS bug could expose them. The mitigations are React's escaping, no `dangerouslySetInnerHTML`, rejecting SVG uploads, and short token lifetimes. A hardened deployment would move the refresh token to an `HttpOnly`, `Secure`, `SameSite` cookie.
- The login endpoint is throttled (`AUTH_THROTTLE_RATE`, default 10/minute).
- Emails are normalized to lowercase, so login and uniqueness checks are case-insensitive.
