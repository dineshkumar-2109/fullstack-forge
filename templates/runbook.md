# Runbook — [Product name]

## Service overview
[What it does, dependencies, where it runs, who owns it.]

## Health
- Liveness: `GET /healthz`
- Readiness: `GET /readyz` (checks: …)
- Dashboards/logs: [where]; correlate with `X-Request-Id`.

## Deploy
1. CI green.  2. Backup DB.  3. Run migrations (`…`).  4. Deploy artifact.  5. Verify (health, key user journey, error logs).

## Roll back
[Exact command; why it is safe (expand/contract migrations); when to restore a backup instead.]

## Backups and restore
[Schedule, retention, restore command, last restore test date.]

## Common incidents
| Symptom | Likely cause | Diagnose | Fix |
|---|---|---|---|
| Elevated 5xx | Bad deploy / dependency down | Error logs by requestId | Roll back / fail over |
| Latency spike | Slow query / saturation | Query plans, pool metrics | Index / scale / shed load |
| 429 surge | Abuse or limits too low | Logs grouped by key | Block / tune limits |

## Secrets rotation
[Where secrets live; how to rotate each without downtime.]

## Contacts and escalation
[Owner, provider support links.]
