# Tasklane runbook

## Health
- Liveness: `GET /healthz` → `{"status":"ok"}`
- Readiness: `GET /readyz` → `{"status":"ready"}`; 503 during shutdown or if the DB is unreachable.
- Every response carries `X-Request-Id`; search logs for it (`"requestId":"…"`).

## Deploy a new version
1. CI green on the commit (format, lint, typecheck, tests, audit, container smoke).
2. Back up the database file (see Backups).
3. Deploy the new image. Migrations apply automatically on boot (or run `npm run db:migrate` as a release step).
4. Verify: `/readyz` is 200, sign in with a test account, create and delete a task, check logs for `unhandled_error`.

## Roll back
- Redeploy the previous image tag. Migrations are additive (expand/contract), so the previous version runs against the newer schema.
- If a migration itself must be reverted, restore the pre-deploy backup — never edit an applied migration.

## Backups
- SQLite in WAL mode: use `sqlite3 /data/tasklane.db ".backup '/backups/tasklane-$(date +%F).db'"` (safe while running) or volume snapshots.
- Schedule daily; keep 7 daily + 4 weekly. **Test a restore monthly** by starting the app against a restored copy.

## Common incidents
| Symptom | Check | Action |
|---|---|---|
| Many 429s | `http_request` logs with status 429 grouped by user/IP | Legit traffic → raise `RATE_LIMIT_*`; abuse → block at the proxy |
| 500s | `unhandled_error` logs; match `requestId` from the user | Roll back if caused by the last deploy; fix forward with a test |
| `database is locked` | Long-running writes, multiple instances on one file | Run exactly one instance per SQLite file; move to PostgreSQL to scale out |
| Users logged out unexpectedly | `SESSION_TTL_HOURS`, clock skew, cookie `Secure` without HTTPS | Fix config; ensure HTTPS in production |
| Disk full | Volume usage | Expand volume; expired sessions are purged hourly |

## Scaling notes
Single instance by design (SQLite + in-memory rate limiter). To run multiple instances: migrate to
PostgreSQL, move the rate limiter to Redis/Postgres, and run the session purge as one scheduled job.
