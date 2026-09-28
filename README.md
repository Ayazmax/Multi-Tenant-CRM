# Multi-Tenant CRM

A production-oriented, multi-tenant CRM built with **Django REST Framework**, **React (TypeScript)**, **PostgreSQL** and **AWS S3**.

Multiple organizations operate independently within the same system. Every user belongs to exactly one organization, and all data access is strictly scoped to that organization.

## Tech stack

| Layer    | Technology                                              |
|----------|---------------------------------------------------------|
| Backend  | Django 5, Django REST Framework, SimpleJWT, django-filter |
| Database | PostgreSQL                                              |
| Storage  | AWS S3 (private bucket, presigned URLs)                 |
| Frontend | React, TypeScript, Vite, React Router, Zustand, TanStack Query |

## Repository structure

```
backend/    Django REST API (versioned under /api/v1/)
frontend/   React + TypeScript single-page application
```

## Status

Work in progress. Setup instructions, architecture notes, and API documentation will be added as the project evolves.
