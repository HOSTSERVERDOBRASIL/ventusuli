# VentuSuli

VentuSuli is a SaaS platform for sports coaching teams built with Next.js (App Router), TypeScript, Prisma, and PostgreSQL.

## Production deployment strategy

- `Dockerfile` is the default production image.
- `Dockerfile.dev` is development-only.
- `Dockerfile.prod` is kept for backward compatibility with existing scripts.
- Production startup always runs:
  1. `prisma migrate deploy`
  2. `next start` with `NODE_ENV=production`

This removes the risk of accidentally running `next dev` in production.

## Health endpoints

`GET /api/health`

- default behavior (`scope=liveness`): process liveness only (fast, no DB dependency).

`GET /api/health?scope=readiness`

- readiness check for deploy/load-balancer:
  - validates runtime env
  - validates database connectivity
  - validates rate limiter backend
  - validates critical dependencies (`auth`, `storage`)
  - returns `503` when not ready

## Local development with Docker

```bash
npm run docker:up
npm run docker:db:migrate
npm run docker:db:seed
```

App: `http://localhost:3000`

## Production with Docker Compose

```bash
npm run docker:prod:up
npm run docker:prod:db:migrate
```

## Railway instructions (exact)

You can deploy in two ways.

### Option A: Railway using Dockerfile (recommended)

1. Connect repository in Railway.
2. Railway will detect `Dockerfile` at repo root.
3. Set environment variables in Railway:
   - `NODE_ENV=production`
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `NEXT_PUBLIC_APP_URL`
4. Healthcheck path:
   - liveness: `/api/health`
   - readiness: `/api/health?scope=readiness`
5. Deploy.

`Dockerfile` already runs migrations before startup.

### Option B: Railway without Docker

Set commands:

- Build command: `npm run build`
- Start command: `npm run railway:start`

This command executes `prisma migrate deploy` before `next start`.

## Key scripts

- `npm run build`
- `npm run start`
- `npm run start:prod`
- `npm run railway:start`
- `npm run db:deploy`
- `npm run test`
- `npm run test:e2e`
- `npm run test:smoke`

## Image uploads (events, avatar, rewards)

### Current architecture

- Dedicated upload endpoint: `POST /api/uploads`
- Auth required (no anonymous upload)
- `multipart/form-data` with fields:
  - `scope`: `events` | `avatars` | `rewards` | `branding`
  - `file`: image file
- Validation:
  - MIME: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`
  - max size: `UPLOAD_MAX_FILE_MB` (default `5MB`)
- Current storage driver: `local`
  - files are saved to `public/uploads/<organization>/<scope>/...`
  - URL returned as `/uploads/...`

### Storage envs

- `STORAGE_DRIVER=local` (current implemented driver)
- `UPLOAD_MAX_FILE_MB=5`
- `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_BASE_URL`
  - reserved for upcoming S3/MinIO/R2 driver integration
  - current build keeps fallback local even when these vars are present

### How to test locally

1. Start app and database:
   - `npm run docker:up`
2. Login as admin and test:
   - `/admin/eventos/novo`: upload event image and save
   - `/admin/recompensas`: upload image when creating/editing reward
3. Login as athlete and test:
   - `/perfil`: change avatar
4. Confirm generated files:
   - `public/uploads/...`

## Production safety checklist

1. `Dockerfile` default is production (no `next dev`).
2. `NODE_ENV=production` is set in production runtime.
3. `prisma migrate deploy` runs at startup in production flow.
4. `GET /api/health` returns `200` when process is alive.
5. `GET /api/health?scope=readiness` returns `200` only when env + DB are ready.
6. Railway environment variables are all configured.
7. Logs confirm app starts with `next start` (not `next dev`).

## E2E and smoke tests

Run E2E (integration-level critical journeys):

```bash
npm run test:e2e
```

Run post-deploy smoke checks:

```bash
npm run test:smoke
```

Environment used by tests:

- `TEST_BASE_URL` (default `http://127.0.0.1:3000`)
- `TEST_SUPER_ADMIN_EMAIL` / `TEST_SUPER_ADMIN_PASSWORD`
- `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`
- `TEST_COACH_EMAIL` / `TEST_COACH_PASSWORD`
- `TEST_ATHLETE_EMAIL` / `TEST_ATHLETE_PASSWORD`

Operational docs:

- [Deploy and rollback checklist](./docs/deploy-rollback-checklist.md)
- [Regression matrix by role and module](./docs/regression-matrix.md)