# Regression Matrix (Profiles x Modules)

## SUPER_ADMIN

| Module            | Route/API                               | Expected            |
| ----------------- | --------------------------------------- | ------------------- |
| Landing           | `/dashboard` -> `/super-admin`          | Redirect is correct |
| Organizations     | `/api/super-admin/organizations`        | 200 + list          |
| Admin invites     | `/api/super-admin/organization-invites` | 200 + list          |
| Tenant admin area | `/admin/*`                              | Blocked/redirected  |

## ADMIN

| Module            | Route/API                                        | Expected                                       |
| ----------------- | ------------------------------------------------ | ---------------------------------------------- |
| Landing           | `/dashboard` -> `/admin`                         | Redirect is correct                            |
| Athletes CRM      | `/api/admin/athletes`                            | 200 + list                                     |
| Events management | `/api/events`                                    | 200 list / create allowed                      |
| Payments ops      | `/api/payments`                                  | 200 + queue/summary                            |
| Notices           | `/api/notices` + `/publish` + `/resend-telegram` | Draft/publish/resend works with clear feedback |
| Rewards admin     | `/api/admin/rewards`                             | 200 + list                                     |
| Super-admin area  | `/super-admin/*`                                 | Blocked/redirected                             |

## COACH

| Module                | Route/API                | Expected                       |
| --------------------- | ------------------------ | ------------------------------ |
| Landing               | `/dashboard` -> `/coach` | Redirect is correct            |
| Coach area            | `/coach/*`               | Allowed                        |
| Athlete operations    | `/api/athletes`          | 200 + list                     |
| Notices read          | `/api/notices` GET       | 200                            |
| Admin APIs            | `/api/admin/*`           | 403                            |
| Athlete personal home | `/`                      | Blocked/redirected to `/coach` |

## ATHLETE

| Module                     | Route/API                                | Expected                      |
| -------------------------- | ---------------------------------------- | ----------------------------- |
| Landing                    | `/dashboard` -> `/`                      | Redirect is correct           |
| Events catalog             | `/api/events`                            | 200 + list                    |
| Registration               | `/api/registrations` POST                | 200/201 with payment pending  |
| My registrations           | `/api/registrations` GET                 | Contains active registrations |
| Financial detail           | `/api/registrations/:id/payment`         | 200 + payment detail          |
| Dashboard data             | `/api/dashboard/athlete`                 | 200 + real metrics            |
| Rewards                    | `/api/rewards`, `/api/rewards/calculate` | 200 + simulation              |
| Redemptions                | `/api/rewards/redemptions/me`            | 200 + timeline                |
| Strava                     | `/api/integrations/strava/*`             | Athlete-only access           |
| Admin/coach/platform areas | `/admin/*`, `/coach/*`, `/super-admin/*` | Blocked/redirected            |

## Shared platform checks

| Area                       | Endpoint                      | Expected                                                 |
| -------------------------- | ----------------------------- | -------------------------------------------------------- |
| Liveness                   | `/api/health`                 | 200 + process=ok                                         |
| Readiness                  | `/api/health?scope=readiness` | 200 only when env/db/rate-limiter/dependencies are ready |
| Unauthenticated protection | Protected pages/APIs          | Redirect to login or 401                                 |

## Priority of execution (manual regression)

1. Authentication and role dispatch
2. Athlete critical journey (events -> registration -> payment detail)
3. Admin operational journey (athletes/events/payments/notices)
4. Coach access constraints
5. Super-admin platform boundaries
6. Integrations (Strava + Telegram behavior)
