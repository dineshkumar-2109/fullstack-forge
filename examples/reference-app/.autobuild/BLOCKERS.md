# Blockers and hard stops

## H-001 — Email provider (hard stop: real credentials, real messages)
- Blocks: password reset, email verification (B-001, B-002).
- Human action: choose a provider (e.g. Postmark/SES/Resend), create an API key, set MAIL_* env vars.
- Fallback in place: feature not exposed in the UI; no dead links.

## H-002 — Production deploy (hard stop: spends money, needs accounts)
- Human action: pick a host with a persistent volume, set PUBLIC_ORIGIN and NODE_ENV=production, run `docker build` / deploy.
- Prepared: Dockerfile (checks + non-root runtime + HEALTHCHECK), docker-compose.yml, CI, runbook.
