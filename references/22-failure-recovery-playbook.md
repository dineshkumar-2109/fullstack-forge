# 22 — Failure Recovery Playbook

Known failure patterns during autonomous builds and how to get unstuck without a human.

## Contents
1. Diagnosis discipline
2. Install and toolchain failures
3. Build and type failures
4. Test failures
5. Runtime failures
6. Database and migration failures
7. Frontend and browser failures
8. Environment limits
9. When to cut scope

---

## 1. Diagnosis discipline

1. Read the **first** error, fully, including the file/line. Later errors are usually consequences.
2. Reproduce with the narrowest command (one test file, one route, one migration).
3. State a hypothesis in one sentence before changing code.
4. Change one thing, rerun. If the error text did not change, your hypothesis was wrong — revert that change.
5. After 3 failed attempts with one approach, change approach (ref 00 §5).

## 2. Install and toolchain failures

| Symptom | Likely cause | Fix |
|---|---|---|
| `ERESOLVE` peer dependency conflict | Incompatible majors | Align versions to what the framework docs require; avoid `--force`; `--legacy-peer-deps` only as a logged last resort |
| Native module build fails (`node-gyp`, `bcrypt`, `sqlite3`) | Missing build tools / no prebuilt binary | Use a pure-JS or WASM alternative (`bcryptjs`, `@node-rs/argon2` prebuilt, `node:sqlite`, `sql.js`), or install build-essential if allowed |
| Network/registry 403/timeout | Sandboxed network | Retry once; check proxy config; otherwise choose stdlib-only path (golden path F) and record the constraint |
| `pip` "externally managed environment" | System Python protected | Use a venv (`python3 -m venv .venv`), or `--break-system-packages` only in disposable sandboxes |
| Wrong runtime version | Tool needs newer Node/Python | Pin in `.nvmrc`/`.python-version`, pick versions compatible with what is installed, document |

## 3. Build and type failures

| Symptom | Fix |
|---|---|
| Type errors after adding a library | Check the library's types/version; don't `any` your way out — narrow with schemas |
| "Cannot find module" in build but not dev | Case-sensitive paths, missing export, path alias not configured for the build tool |
| ESM/CJS mismatch (`require is not defined`, `ERR_REQUIRE_ESM`) | Make the package consistent (`"type": "module"` or not); use dynamic import for ESM-only deps |
| Server-only code bundled to client | Move into server modules; mark server-only; never import config with secrets in client components |
| Env var undefined at build time | Distinguish build-time public vars (e.g. `NEXT_PUBLIC_*`) from runtime secrets |

## 4. Test failures

| Symptom | Likely cause | Fix |
|---|---|---|
| Passes alone, fails in suite | Shared state (DB rows, module singletons, env) | Isolate DB per test/file (transaction rollback or fresh DB), reset singletons |
| Intermittent timing failures | Real clock, race, unawaited promise | Fake timers / injected clock; await everything; wait on conditions not durations |
| Snapshot churn | Non-deterministic data in output | Seed IDs/dates deterministically; snapshot only stable parts |
| E2E can't find element | Selector tied to markup, not semantics; state not ready | Use role/label selectors; `expect(...).toBeVisible()` auto-waits |
| Port already in use | Previous run still alive | Kill by PID you started; use port 0/random port in tests |

## 5. Runtime failures

| Symptom | Fix |
|---|---|
| 500 with no useful log | Central error handler must log the error with request ID and stack (server-side only) |
| Request hangs | Missing `await`/response; no timeout on outbound call; DB pool exhausted → add timeouts, release connections |
| CORS error in browser | Configure allowed origin explicitly for the frontend origin; credentials require explicit origin (not `*`) |
| Cookie not set | `Secure` cookie on http localhost in some browsers, wrong `SameSite`, domain mismatch → use `Secure` conditional on HTTPS/production |
| Memory growth | Unbounded caches/arrays, listeners never removed → bound with LRU/TTL |

## 6. Database and migration failures

| Symptom | Fix |
|---|---|
| Migration fails on existing data | Expand/contract: add nullable column → backfill → add constraint in a later migration |
| Unique violation surfaces as 500 | Catch the constraint error in the repository and map to 409 CONFLICT |
| Deadlocks / lost updates | Consistent lock ordering; `SELECT … FOR UPDATE` or optimistic version column; keep transactions short |
| Slow list endpoint | Missing index on (owner_id, created_at); N+1 in serializer → join/batch |
| Tests pollute each other | Fresh DB per test file or transaction-per-test |

## 7. Frontend and browser failures

| Symptom | Fix |
|---|---|
| Hydration mismatch | Non-deterministic render (dates, random, `window`) on server → render on client or pass from server |
| Infinite render/effect loop | Unstable dependency (new object each render) → memoize or restructure |
| Layout broken on mobile | Fixed widths, long unbroken strings, wide tables → `min-width: 0`, `overflow-wrap: anywhere`, scroll containers |
| Blank page in production only | Check browser console in smoke test; missing env var; asset path/base URL |

## 8. Environment limits

| Missing | Substitute | Report as |
|---|---|---|
| Docker daemon | Validate Dockerfile by review; run app directly | "Docker build not run" |
| Postgres server | SQLite/PGlite in tests if ORM-compatible; otherwise integration tests skipped | "Integration tests ran against SQLite, not Postgres" |
| Browser | HTTP smoke + HTML assertions | "No visual verification" |
| Outbound network | Stdlib/vendored deps, fakes for providers | "Provider adapters untested against real APIs" |
| Real credentials | Fake adapters + test mode | Hard stop listed with exact env vars needed |

## 9. When to cut scope

Cut (move to BACKLOG with reason) when a feature:
- blocks the core loop's stability, or
- has consumed 2× its estimate with no convergence, or
- depends on a hard stop with no meaningful fake.

Cut the **optional part** first (e.g. keep upload, drop image thumbnails). The product
that ships must be coherent: no dead buttons, no links to unfinished pages — hide them
behind a disabled feature flag instead.
