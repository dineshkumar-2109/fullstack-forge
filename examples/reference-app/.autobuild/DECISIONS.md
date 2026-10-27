# Decisions

## D-001 — Zero runtime dependencies (Node stdlib + node:sqlite)
- Context: reference app must run in restricted environments and be readable end to end.
- Options: Next.js + Prisma (golden path A); Fastify + better-sqlite3; Node stdlib.
- Decision: Node ≥ 22.13 stdlib, `node:sqlite`, JSDoc types checked by `tsc --checkJs`. Dev-only tooling: eslint, typescript.
- Reversibility: medium — routes/services map 1:1 onto any framework. Source: judgement (environment + teaching goal).

## D-002 — Cookie sessions over JWT
- Decision: random 256-bit token in HttpOnly SameSite=Lax cookie; store SHA-256 only; server-side revocation.
- Why: instant sign-out/revocation, no token storage in JS, simpler than refresh-token rotation. Source: default (ref 18 §1).

## D-003 — 404 for other users' resources
- Decision: owner-scoped queries return "not found" whether the row is missing or belongs to someone else.
- Why: prevents ID probing. Source: default (ref 18 §2).

## D-004 — scrypt N=2^15 for passwords
- Decision: Node's built-in scrypt (no native deps). ~100 ms per hash on a small instance.
- Trade-off: OWASP prefers N=2^17; documented in `security.js`; raise when hardware allows. Source: judgement.

## D-005 — Optimistic concurrency on tasks
- Decision: `version` column; PATCH requires the version; stale → 409.
- Why: two tabs/devices must not silently overwrite each other. Source: judgement.

## D-006 — Keyset pagination with opaque cursors
- Decision: order by (created_at DESC, id DESC); cursor = base64url([createdAt, id]); limit 1–100 (tasks 1–200). Source: default.

## D-007 — In-memory rate limiter
- Decision: fixed window per IP (auth) and per user (API). Correct for one instance only; swap note in runbook. Source: judgement.

## D-008 — Duplicate sign-up returns 409
- Context: reveals that an email is registered (enumeration).
- Decision: accept for MVP — the friendly UX matters more and sign-in/rate limits are uniform. Revisit with email verification (B-001).

## D-009 — /api/session probe (added in P5)
- Context: smoke test showed every logged-out page load produced a 401 console error from `/api/me`.
- Decision: `GET /api/session` returns 200 `{ user | null }` for the UI; `/api/me` keeps strict 401 semantics for API clients.
