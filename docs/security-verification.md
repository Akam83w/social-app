# SDM security verification checklist

## Web/API
- Strict Zod validation for authentication, profile, settings, messages, comments, reports, calls, stories, video uploads and notification payloads.
- OAuth-issued JWTs include `authVersion` so global session revocation applies to OAuth sessions.
- Password changes and logout-all increment `authVersion`.
- Authentication and abuse quotas use Redis-backed counters rather than process RAM.
- Realtime events use Redis Streams rather than per-process client maps.
- Call expiry is persisted in PostgreSQL; instances run a stateless expiry sweep.
- Uploaded image references are restricted to trusted storage/data-image sources.
- Video uploads are checked with ffprobe and sampled through moderation before publication.
- Security response headers are enabled.

## Mobile
Review the Android build against OWASP MASVS/MASTG categories: storage, cryptography, authentication, network, platform interaction, code quality, resilience and privacy.

## Database
All public tables should have an intentional RLS state and policies. The current connected Supabase project still reports three public tables without RLS: `comment_likes`, `user_notes`, and `user_settings`. The RLS remediation requires an explicit database change and must be applied after reviewing policies.

## Operational verification
- Prometheus-compatible `/metrics` endpoint is available behind `METRICS_TOKEN`.
- 5xx spikes can trigger `ALERT_WEBHOOK_URL`.
- `/health` checks PostgreSQL connectivity.
- CI runs API tests before web and Docker builds.