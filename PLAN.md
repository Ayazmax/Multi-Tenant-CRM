# Multi-Tenant CRM — Phase Plan

Associate Full Stack Developer Technical Examination (Sublime Travel / Luxury Explorer).
Deadline: 24 hours from receipt.

## Stack

| Layer    | Choice                                                                 |
|----------|------------------------------------------------------------------------|
| Backend  | Django 6, Django REST Framework, SimpleJWT, django-filter              |
| Config   | django-environ, split settings (base / dev / prod)                     |
| Database | PostgreSQL (local install, via `DATABASE_URL`)                         |
| Storage  | AWS S3 via django-storages + boto3 (private bucket, presigned URLs); local filesystem fallback when `USE_S3=False` |
| Frontend | React + TypeScript (Vite), React Router, Axios                         |
| State    | Zustand (auth/session), TanStack React Query (server state)            |
| Tests    | pytest + pytest-django                                                 |

## Repository layout

```
/
├── backend/
│   ├── config/
│   │   ├── settings/{base,dev,prod}.py
│   │   ├── urls.py                 # mounts /api/v1/
│   │   └── wsgi.py / asgi.py
│   ├── apps/
│   │   ├── core/                   # tenant base model, managers, middleware, permissions,
│   │   │                           # response renderer, exception handler, pagination, mixins
│   │   ├── accounts/               # Organization, User (org + role), auth endpoints, dashboard
│   │   ├── crm/                    # Company, Contact (models, serializers, services, views, filters)
│   │   └── activity/               # ActivityLog model, logging service, read-only viewset
│   ├── requirements/{base,dev,prod}.txt
│   ├── .env.example
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── api/                    # axios client, interceptors, endpoint modules
│   │   ├── store/                  # zustand auth store
│   │   ├── hooks/                  # react-query hooks per resource
│   │   ├── components/             # reusable UI (DataTable, Pagination, Modal, ...)
│   │   ├── pages/                  # Login, Dashboard, Companies, CompanyDetail, ActivityLog
│   │   ├── routes/                 # ProtectedRoute, router config
│   │   └── types/                  # shared TS types
│   └── .env.example
├── README.md
└── PLAN.md
```

## Key design decisions

1. **Tenant isolation (defense in depth)**
   - `TenantModel` abstract base: `organization` FK, `is_deleted`, `created_at`, `updated_at`.
   - `TenantManager` / `TenantQuerySet`: default manager hides soft-deleted rows; `.for_organization(org)` helper; `all_objects` manager for admin/audit use.
   - `TenantScopedViewSetMixin`: `get_queryset()` always filters by `request.user.organization`.
   - `organization` is injected server-side in `perform_create` — never accepted from the request body.
   - Cross-tenant FK validation: a Contact's `company` must belong to the user's organization.
   - Middleware attaches `request.organization` (resolved lazily after JWT auth) for use in services/logging.
   - Cross-tenant object access returns **404**, not 403 (no existence leak).
2. **RBAC**

   | Action           | Staff | Manager | Admin |
   |------------------|:-----:|:-------:|:-----:|
   | List / retrieve  |  yes  |   yes   |  yes  |
   | Create           |  yes  |   yes   |  yes  |
   | Update           |  no   |   yes   |  yes  |
   | Delete (soft)    |  no   |   no    |  yes  |
   | View activity log|  no   |   yes   |  yes  |

   Implemented as custom DRF permission classes (`IsSameOrganization`, `RoleBasedPermission`) mapped per action.
3. **Activity log** — explicit `ActivityLogService.log(user, action, instance)` called from the service layer on create/update/delete (signals can't see `request.user`). Stores user, action, model name, object id, timestamp, organization, plus an optional `changes` JSON diff.
4. **Soft delete** — `destroy()` sets `is_deleted=True`; logged as DELETE.
5. **Contact email uniqueness** — DB `UniqueConstraint(company, email, condition=is_deleted=False)`; emails lowercased on save; serializer-level validation gives a friendly error.
6. **Phone** — optional, regex `^\d{8,15}$`.
7. **S3 strategy** — private bucket with Block Public Access on; objects under `org_<id>/logos/<uuid>.<ext>`; API returns short-lived **presigned GET URLs** (e.g. 1 hour). IAM user limited to `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*`. Upload validation: max 2 MB, image types only. Credentials only from env.
8. **Consistent responses** — custom renderer/exception handler producing:
   ```json
   { "success": true, "message": "...", "data": {...}, "errors": null, "meta": { "pagination": {...} } }
   ```
9. **API routes (`/api/v1/`)**
   - `POST auth/login/`, `POST auth/refresh/`, `GET auth/me/`
   - `GET dashboard/` (org info + counts + recent activity)
   - `companies/` (CRUD, search, filter, pagination, logo upload)
   - `contacts/` (CRUD, `?company=<id>`, search, filter, pagination)
   - `activity-logs/` (read-only, filter by action/model/user, pagination)

---

## Phase 0 — Setup (0.5 h)

- [ ] Create GitHub repository, clone locally
- [ ] Root `.gitignore` (Python, Node, `.env`, media, build output)
- [ ] Create local PostgreSQL database and user
- [ ] Commit: `chore: initial repository structure`

## Phase 1 — Backend scaffold & configuration (1.5 h)

- [ ] Virtualenv, `requirements/{base,dev,prod}.txt`
- [ ] Django project `config`, split settings `base/dev/prod`
- [ ] `django-environ` for all secrets and toggles; `backend/.env.example`
- [ ] PostgreSQL via `DATABASE_URL`
- [ ] CORS via `CORS_ALLOWED_ORIGINS` env (strict list in prod)
- [ ] Prod hardening: `DEBUG=False`, `ALLOWED_HOSTS`, secure cookies, HSTS, SSL redirect
- [ ] DRF defaults: JWT auth, `IsAuthenticated`, pagination, filter backends
- [ ] Commit: `feat(backend): project scaffold with env-based dev/prod settings`

## Phase 2 — Core tenant layer (2 h)

- [ ] `apps/core`: `TimeStampedModel`, `TenantModel`, `TenantQuerySet`/`TenantManager`
- [ ] `TenantMiddleware` (request.organization)
- [ ] `TenantScopedViewSetMixin` (scoped queryset + org injection)
- [ ] Standard response renderer, custom exception handler, custom pagination class
- [ ] Commit: `feat(core): tenant-aware base models, managers and middleware`

## Phase 3 — Accounts & authentication (2 h)

- [ ] `Organization` (name, subscription_plan Basic/Pro, created_at)
- [ ] Custom `User` (AbstractUser + organization FK + role Admin/Manager/Staff)
- [ ] SimpleJWT login/refresh; custom token claims (role, org id)
- [ ] `GET auth/me/`
- [ ] Permission classes: `IsSameOrganization`, `RoleBasedPermission`
- [ ] Django admin registration
- [ ] Commit: `feat(accounts): organizations, role-based users and JWT auth`

## Phase 4 — CRM: Companies & Contacts (3 h)

- [ ] `Company` model + serializer + service + viewset
- [ ] `Contact` model + serializer (email/phone validation, per-company uniqueness) + service + viewset
- [ ] Search (`name`, `industry`, `country` / `full_name`, `email`), filters, ordering
- [ ] Soft delete in `destroy()`
- [ ] Cross-tenant FK validation on Contact.company
- [ ] Commit: `feat(crm): company and contact CRUD with search, filters, soft delete`

## Phase 5 — Activity log (1 h)

- [ ] `ActivityLog` model (organization, user, action, model_name, object_id, changes, timestamp)
- [ ] `ActivityLogService` wired into Company/Contact services
- [ ] Read-only, org-scoped viewset with filters
- [ ] Commit: `feat(activity): audit log for create/update/delete actions`

## Phase 6 — File storage (S3) (1 h)

- [ ] `django-storages` S3 backend, private ACL, presigned URLs
- [ ] `USE_S3` toggle with local `FileSystemStorage` fallback for dev
- [ ] Logo upload validation (size, type), org-prefixed upload path
- [ ] Delete old logo on replace
- [ ] Commit: `feat(storage): S3 logo uploads with presigned URLs`

## Phase 7 — Tests & seed data (2 h)

- [ ] `seed_demo` management command: 2 orgs × (Admin, Manager, Staff) + sample companies/contacts
- [ ] Tests: tenant isolation (list/retrieve/update/delete across orgs → 404)
- [ ] Tests: RBAC matrix per role
- [ ] Tests: contact validation (email format, per-company uniqueness, phone)
- [ ] Tests: activity log created for each action; soft delete hides records
- [ ] Commit: `test: tenant isolation, RBAC, validation and audit coverage`

## Phase 8 — Frontend scaffold (2 h)

- [ ] Vite + React + TS, ESLint, path aliases, `frontend/.env.example` (`VITE_API_BASE_URL`)
- [ ] Axios client: base URL, auth header, 401 → refresh → retry, normalized errors
- [ ] Zustand auth store (tokens, user, login/logout, persisted)
- [ ] React Query provider
- [ ] Router + `ProtectedRoute` + app layout (sidebar/topbar)
- [ ] Commit: `feat(frontend): scaffold with API client, auth store and protected routing`

## Phase 9 — Reusable components (1 h)

- [ ] `DataTable`, `Pagination`, `SearchInput`, `Select` filter
- [ ] `Modal`, `ConfirmDialog`, `FormField`, `Button`
- [ ] `Spinner`/`LoadingState`, `ErrorState`, `EmptyState`
- [ ] `RoleGate` (hide actions the role cannot perform)
- [ ] Commit: `feat(frontend): reusable UI components`

## Phase 10 — Pages (4 h)

- [ ] Login page (validation, error display)
- [ ] Dashboard (org name/plan, counts, recent activity)
- [ ] Companies page (list, search, filter, pagination, create/edit modal with logo upload, delete)
- [ ] Company detail page (info + logo + nested contacts table with CRUD)
- [ ] Activity log page (filters + pagination; Manager/Admin only)
- [ ] Commit(s): `feat(frontend): <page> page`

## Phase 11 — AWS setup (0.5 h, needs new AWS account)

- [ ] Budget alert ($1 / zero-spend) created first
- [ ] S3 bucket in `ap-south-1`, Block Public Access ON
- [ ] IAM user with least-privilege bucket policy; access keys into `.env` only
- [ ] Bucket CORS if needed; verify upload + presigned URL
- [ ] Fallback: if account is unavailable, demo with `USE_S3=False` and show config/IAM policy in README

## Phase 12 — Documentation & polish (1.5 h)

- [ ] README: overview, architecture diagram, tenant isolation explanation, RBAC matrix,
      S3 strategy + IAM policy JSON, API reference, setup (Postgres, backend, frontend), demo credentials, tests
- [ ] Verify `.env.example` files are complete; no secrets committed
- [ ] Lint/format pass (ruff/black, eslint/prettier)
- [ ] Commit: `docs: README with architecture, setup and security notes`

## Phase 13 — Screen recording (1.5 h incl. rehearsal)

15–20 minutes, app running locally:

1. System overview & architecture (repo tour, layers, tenant model) — 4 min
2. Authentication flow (login, JWT, refresh, protected routes) — 3 min
3. CRUD: companies (logo to S3), contacts (validation errors) — 5 min
4. RBAC: Staff vs Manager vs Admin behaviour — 2 min
5. Tenant isolation: second org cannot see data (UI + API 404) — 2 min
6. Activity log — 2 min
7. Production readiness: env, settings split, CORS, tests — 2 min

## Phase 14 — Submission

- [ ] Final push, check repo from a clean clone
- [ ] Upload recording (YouTube unlisted / Google Drive with link access)
- [ ] Reply to email with repo link + recording link

---

## Time budget

| Phase | Hours |
|-------|------:|
| 0–1 Setup & scaffold          | 2   |
| 2–3 Tenant core & auth        | 4   |
| 4–6 CRM, activity, storage    | 5   |
| 7 Tests & seed                | 2   |
| 8–10 Frontend                 | 7   |
| 11–12 AWS & docs              | 2   |
| 13–14 Recording & submission  | 2   |
| **Total**                     | **24** |

Priority if time runs short: tenant isolation, RBAC, CRUD, activity log, and the recording are non-negotiable; `changes` diff, extra tests and UI polish are first to cut.
