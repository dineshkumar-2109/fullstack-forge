# Tasklane

Projects and tasks, without the clutter. Sign up, create projects, add tasks with due dates,
move them through **To do → Doing → Done**, export your data or delete your account at any time.

> This app is the reference implementation for the `fullstack-engineering` skill. It has **zero
> runtime dependencies** (Node.js standard library + built-in SQLite) so it runs anywhere, yet it
> carries the production patterns a real product needs. Copy the patterns, not necessarily the stack.

## Quick start

Requires Node.js ≥ 22.13 (see `.nvmrc`).

```bash
npm ci                 # dev tooling only (eslint, typescript); the app itself has no dependencies
cp .env.example .env   # optional — every variable has a safe default for development
npm run db:seed        # creates demo@tasklane.test / demo-password-123
npm start              # http://localhost:3000
```

`npm start` reads configuration from the environment. To use `.env`, export it first
(`set -a; . ./.env; set +a`) or run `node --env-file=.env --disable-warning=ExperimentalWarning src/server.js`.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Start the server (applies pending migrations on boot) |
| `npm run dev` | Start with file watching |
| `npm test` | 48 tests: auth, core loop, IDOR matrix, CSRF, XSS, injection, limits, rate limiting, ops |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript in `checkJs` strict mode over JSDoc-typed sources |
| `npm run format:check` | Whitespace/line-ending formatting check |
| `npm run db:migrate` | Apply pending migrations and exit |
| `npm run db:seed` | Create a demo user with sample data (refuses in production) |

## Environment variables

All variables are validated at startup; invalid values stop the process with a clear message.
See [`.env.example`](.env.example) for descriptions.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` enables `Secure` cookies and HSTS |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | |
| `DATABASE_PATH` | `./data/tasklane.db` | Must be a file in production; mount a volume |
| `SESSION_TTL_HOURS` | `336` (14 days) | |
| `LOG_LEVEL` | `info` | JSON logs to stdout |
| `TRUST_PROXY` | `false` | `true` only behind a proxy that sets `X-Forwarded-For` |
| `PUBLIC_ORIGIN` | – | e.g. `https://tasklane.example.com`; used for CSRF origin checks behind proxies |
| `MAX_BODY_BYTES` | `65536` | |
| `RATE_LIMIT_AUTH_PER_MINUTE` / `RATE_LIMIT_API_PER_MINUTE` | `10` / `300` | Per IP / per user |

## Architecture

```
Browser SPA (public/)  ──fetch, same-origin cookie──►  node:http server (src/app.js)
                                                         ├─ request id, security headers, access log
                                                         ├─ CSRF origin check, rate limits, session auth
                                                         ├─ router → routes (parse + validate)
                                                         │            → services (rules, owner-scoped SQL)
                                                         └─ SQLite (WAL, FK on) ← migrations/*.sql
```

- `src/config.js` — the only place that reads `process.env`.
- `src/lib/` — errors + envelope, validation (rejects unknown fields), security (scrypt, tokens, headers, rate limiter), http (body limits, router, cursors), db (migrations, transactions), logger (JSON, redaction).
- `src/modules/<feature>/` — `*.routes.js` (HTTP) and `*.service.js` (rules + queries). Every query is filtered by the authenticated `owner_id`.
- `public/` — dependency-free SPA; all user content rendered via `textContent`; CSP allows only same-origin scripts and styles.

Key decisions (full log in the skill's walkthrough example):
- Sessions are random 256-bit tokens in `HttpOnly; SameSite=Lax` cookies; only their SHA-256 is stored.
- Other users' resources return **404**, not 403, so IDs can't be probed.
- Task updates use **optimistic concurrency** (`version`) → stale writes get 409 instead of silently overwriting.
- Keyset (cursor) pagination; opaque prefixed random IDs.
- SQLite is right for a single instance. To scale out, move to PostgreSQL (SQL is portable) and move the rate limiter to a shared store.

## API

See [`docs/api.md`](docs/api.md). Errors always look like:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please correct the highlighted fields.", "details": [{ "field": "name", "reason": "required" }], "requestId": "…" } }
```

## Deploy

Container-first. Build and run:

```bash
docker build -t tasklane .
docker run -p 3000:3000 -v tasklane-data:/data -e PUBLIC_ORIGIN=http://localhost:3000 tasklane
```

The image runs the full check suite in a build stage, then ships a non-root runtime with a
`HEALTHCHECK`. Any container platform with a persistent volume works (Fly.io, Render, Railway,
a VM with Docker). Operational procedures — migrations, rollback, backups, incidents — are in
[`docs/runbook.md`](docs/runbook.md).

## Privacy

Users can export all their data (`GET /api/me/export`) and delete their account and all data
(`DELETE /api/me`). Logs contain no request bodies, query strings, or secrets. `/terms` and
`/privacy` are **placeholders** that must be written or reviewed by a qualified professional before launch.
