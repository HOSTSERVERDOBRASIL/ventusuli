# Deploy and Rollback Checklist (VentoSuli)

## Pre-deploy

1. Confirm migration status:
   - `npm run db:status`
2. Run static quality gates:
   - `npm run type-check`
   - `npm run lint`
   - `npm run build`
3. Run automated critical journeys:
   - `npm run test:e2e`
4. Validate required envs in target environment:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `NEXT_PUBLIC_APP_URL`
5. Validate production safety envs:
   - `NODE_ENV=production`
   - `NEXT_PUBLIC_DEMO_MODE=false`
   - `DEMO_AUTH_ENABLED=false`
6. Validate readiness dependencies:
   - If `STORAGE_DRIVER=s3`, do not deploy until S3 driver is enabled in runtime
   - Configure Redis/Upstash rate limiter backend

## Deploy

1. Build and release using production image (`Dockerfile`).
2. Run migrations:
   - `prisma migrate deploy`
3. Start application:
   - `next start`
4. Run smoke checks:
   - `npm run test:smoke`

## Post-deploy verification

1. Health checks:
   - `GET /api/health` must return `200`
   - `GET /api/health?scope=readiness` must return `200`
2. Session checks:
   - login / refresh / logout
3. Role routing checks:
   - SUPER_ADMIN -> `/super-admin`
   - ADMIN -> `/admin`
   - COACH -> `/coach`
   - ATHLETE -> `/`
4. Critical operations:
   - athlete registration flow
   - admin notices publication
   - reward redemption listing

## Rollback strategy

1. Trigger rollback to previous container/image tag.
2. Revert app-level env changes if any were deployed with current release.
3. Re-run smoke checks against rollback version.
4. If migration introduced breaking schema changes:
   - apply forward-fix migration (preferred)
   - avoid destructive rollback migration without explicit data plan
5. Open incident record including:
   - failure timestamp
   - request IDs
   - affected modules/roles

## Incident fallback

1. Keep platform in read-only operational mode for risky modules if needed.
2. Disable integrations with repeated failure:
   - Telegram notices (keep in-app notices)
   - Strava sync (keep dashboard with honest empty state)
3. Communicate user-visible impact and ETA.
