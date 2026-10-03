# SDM production runbook

## Required production services
- PostgreSQL/Supabase with tested backups and a documented restore path.
- Redis-compatible REST service using `REDIS_REST_URL` and `REDIS_REST_TOKEN`.
- FCM credentials for Android push.
- Web Push VAPID keys stored server-side.
- Supabase service-role/secret storage key only on the API server.
- `OPENAI_API_KEY` for image/video moderation.
- `METRICS_TOKEN` for Prometheus scraping.
- Optional `ALERT_WEBHOOK_URL` for immediate 5xx spike alerts.

## Release gate
1. `npm ci` succeeds for API and web.
2. API build, web build, and API tests pass.
3. Redis `PING` succeeds before API startup in production.
4. Database schema verification succeeds.
5. Health endpoint reports database connectivity.
6. Smoke-test register/login, session revocation, posts, comments, messages, calls, stories, video upload, notifications and account deletion.
7. Verify moderator report and appeal workflows with a non-production test account.
8. Verify Android push and incoming call notification on physical devices.
9. Verify backups and perform a restore rehearsal before the first public release.

## Backup/restore rehearsal
Use a disposable Supabase development branch or isolated PostgreSQL instance. Never restore over production for a rehearsal.
1. Record the production schema/migration version.
2. Create a logical database backup using the database provider's supported backup/export mechanism.
3. Restore that backup into the disposable environment.
4. Run row-count and integrity checks for users, posts, comments, messages, stories, calls, notifications and moderation tables.
5. Run the API smoke suite against the restored database.
6. Record restore duration, data-loss window and any manual repair steps.
7. Repeat after schema changes that affect user data.

## Account deletion
The API deletes the user row. Current production foreign keys use cascading deletes for the user-owned relational data. Media objects in external storage must also be removed by the storage cleanup workflow before claiming a complete storage purge.

## RPO/RTO
Define the actual values with the database/hosting plan before launch. Do not publish a numeric RPO/RTO until a restore rehearsal has measured it.