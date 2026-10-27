# Delivery report — Tasklane 1.0.0

## What was built
A personal projects-and-tasks web app: accounts, projects, tasks with due dates and a
To do → Doing → Done workflow, status filters, overdue highlighting, data export and account deletion.
Responsive SPA + JSON API + SQLite, zero runtime dependencies.

## Run it
`npm ci && npm run db:seed && npm start` → http://localhost:3000 (demo@tasklane.test / demo-password-123)

## Verification (evidence level reached: 9 of 9, except the container build)
| Check | Result |
|---|---|
| `npm run format:check` | PASS |
| `npm run lint` | PASS (0 problems) |
| `npm run typecheck` | PASS (strict checkJs) |
| `npm test` | PASS — 48 tests, 0 failed |
| `npm audit` | PASS — 0 vulnerabilities |
| `scripts/secret_scan.py` | PASS — 0 findings |
| `scripts/readiness_audit.py` | PASS — 100/100, 0 critical failures |
| `scripts/smoke_test.mjs` (8 paths × desktop + mobile) | PASS — 16/16 clean; screenshots in `screenshots/` |
| `npm run test:e2e` (real browser, all stories) | PASS — 7/7 steps, 0 browser errors |
| Graceful shutdown (SIGTERM) | PASS — `shutdown_started` → `shutdown_complete` in logs |
| `docker build` | NOT RUN — no Docker daemon in the build environment; CI job `docker` builds and smoke-tests the image |
| Fresh-clone test (copy without node_modules → `npm ci`, test, lint, typecheck, format, seed) | PASS |

## Found and fixed during self-verification
- Logged-out pages produced a 401 console error (session probe) → added `/api/session` (D-009) + test.
- Visual: focus ring drawn around the hero heading on load; "Add task" button misaligned; mobile header wrapped to two rows → fixed and re-verified by screenshot.

## Human actions needed (hard stops)
- H-001: choose an email provider to enable password reset and verification.
- H-002: choose a host and deploy (Dockerfile, compose file, CI and runbook are ready).
- Have `/terms` and `/privacy` written or reviewed by a professional (placeholders are clearly marked).

## Known limitations
Single instance (SQLite + in-memory rate limiter); no password reset yet; rename/delete use browser
dialogs (B-003). See BACKLOG.md.
