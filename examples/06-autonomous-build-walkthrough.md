# Example — Autonomous Build Walkthrough: one sentence → shipped product

This is the actual build of `examples/reference-app/` (Tasklane), shown phase by phase. Every
artifact referenced here exists in `reference-app/.autobuild/`. Use it as the model for any
autonomous build.

**The entire human input:**
> "Build me a simple app to manage my projects and tasks. Make it production-ready."

No further human messages until the delivery report.

---

## P0 — Intake (≈ 2 minutes)

```bash
python3 scripts/init_state.py ./tasklane --goal "Simple, production-ready projects and tasks app"
python3 scripts/detect_stack.py ./tasklane          # → 0 files, mode hint: greenfield
node --version; npm view typescript version; docker info; node -e "require('playwright')"
```

Recorded in PROGRESS.md → *Environment constraints*:
- Node 22.23 with `node:sqlite`; npm registry reachable; Chromium + Playwright available.
- **No Docker daemon** → container build cannot be verified here (will say so in the report).

Mode: **autonomous build**. No hard stops yet.

## P1 — Spec (≈ 10 minutes)

Expanded the sentence with `references/16` → one persona ("individual managing 2–15 projects"),
one core loop ("pick project → add/move task → see what's open and late"), and the implied
features for "any product with accounts": sign-out, session expiry, **export and delete account**,
404 page, empty/loading/error states, legal page placeholders.

Cut to 6 must-have stories (S-01…S-06). Password reset was a *should* but depends on an email
provider → **hard stop H-001** → deferred (B-001) rather than shipping a dead "Forgot password?" link.

Artifact: `.autobuild/PRD.md`. Gate check: every must-have story has Given/When/Then including a
validation case, an authorization case, and an empty state. ✔

## P2 — Architecture (≈ 10 minutes)

Decisions logged as D-001…D-008, for example:
- D-001: zero runtime dependencies (environment + teaching goal) — *source: judgement*.
- D-002: cookie sessions, hashed tokens — *source: default (ref 18 §1)*.
- D-003: 404 for other users' resources — *source: default*.
- D-005: optimistic concurrency on tasks — *source: judgement (multi-tab editing)*.

Threat model (template `threat-model.md`) produced the abuse cases that later became tests:
IDOR, brute force, stored XSS, CSRF, mass assignment, oversized payloads, secrets in logs.

Story → implementation map: S-03 → `POST /api/projects/:id/tasks` → `tasks` table → task form
in `/app` → tests in `projects-tasks.test.js`.

## P3 — Walking skeleton (≈ 20 minutes)

Built first, before any feature: validated config, JSON logger with redaction, error envelope,
router, body limits, security headers, migrations runner, `/healthz` + `/readyz`, graceful shutdown,
lint/typecheck/test/format scripts, `.env.example`, Dockerfile, CI.

```bash
python3 scripts/quality_gate.py ./tasklane
# format PASS · lint PASS · typecheck PASS · test PASS   → Result: PASS
```

## P4 — Vertical slices (≈ 60 minutes)

Each story: tests from acceptance criteria → migration → service (owner-scoped SQL) → route →
UI states → quality gate → tick in PROGRESS.md.

Two first-run lint failures were fixed properly rather than silenced globally:
`no-control-regex` (intentional — disabled on that line with a reason) and a useless assignment.

## P5 — Self-verification (≈ 20 minutes) — where real bugs were found

```bash
npm run db:seed && PORT=4010 npm start &
node scripts/smoke_test.mjs --base-url http://localhost:4010 \
  --paths / /login /signup /terms /privacy --not-found /no-such-page
node scripts/smoke_test.mjs --base-url http://localhost:4010 --paths /app /settings \
  --login-path /login --email demo@tasklane.test --password demo-password-123
```

**First run FAILED** — every logged-out page logged a browser console error:
`GET /api/me 401`. The UI used a strict API endpoint as a session probe. Unit tests could never
catch this. Fix: `GET /api/session` → 200 `{ user | null }` (D-009) + a new test. Re-run: clean.

**Screenshots reviewed** (read as images) — three defects no automated check flagged:
1. A focus ring drawn around the hero heading on page load (programmatic focus) → `[tabindex="-1"]:focus { outline: none }`.
2. "Add task" button sat 16 px lower than the inputs on desktop → removed field margin inside the grid.
3. Mobile header wrapped onto two rows → compact buttons, brand links to `/app`, "Projects" hidden on mobile.

Lesson recorded: *static files are cached at startup — restart the server before re-checking CSS.*

Then every story walked through the real UI:
```bash
BASE_URL=http://localhost:4010 npm run test:e2e
# PASS S-01 sign up … PASS S-06 export data and delete account
# E2E PASSED — all stories walked through the UI with zero browser errors
```

## P6 — Hardening (≈ 20 minutes)

Red-team kit from `references/06` turned into `tests/security.test.js`: IDOR matrix over all 7
resource routes (→ 404, nothing changes), mass assignment (`ownerId`, `id`, `role` → 400
`unknown_field`), XSS and SQL payloads stored inertly, 413/415/400 limits, cross-origin writes → 403,
brute force → 429 with `Retry-After`, path traversal on static files → 404, request-id injection.

```bash
python3 scripts/secret_scan.py ./tasklane    # no secrets found
npm audit                                    # found 0 vulnerabilities
```

## P7 — Packaging (≈ 15 minutes)

README (quick start in 4 commands), `docs/api.md`, `docs/runbook.md`, CHANGELOG.

```bash
python3 scripts/readiness_audit.py ./tasklane
# first run: 88/100, 1 critical failure (README missing)  → wrote docs
# second run: 100/100, 0 critical failures → AUDIT PASSED
```

## P8 — Delivery

Fresh-clone test: copied the project without `node_modules`, ran `npm ci`, tests, lint, typecheck,
format and seed from scratch — all PASS (evidence level 9).

`.autobuild/DELIVERY.md` — evidence table (every PASS observed), one NOT RUN row with its reason
(Docker build: no daemon), bugs found during verification, hard stops for the human (email
provider, hosting, legal text), known limitations.

---

## What made this autonomous *and* trustworthy

| Practice | Effect |
|---|---|
| Decisions logged with sources | A human can audit 9 choices in 2 minutes instead of reading code |
| Hard stops isolated early | No stalled build; email/deploy prepared, not faked |
| Skeleton before features | Every later slice was verified by the same gate |
| Browser smoke + screenshot review | Found 4 real defects that 47 passing tests could not |
| Honest NOT RUN row | The report can be trusted — nothing claimed that wasn't observed |
