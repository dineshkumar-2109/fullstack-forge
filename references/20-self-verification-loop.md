# 20 — Self-Verification Loop

Code review by its author is weak evidence. Running the product like a user is strong
evidence. This file defines how to prove the product works without a human tester.

## Contents
1. The evidence ladder
2. The verification loop
3. Running the app for verification
4. Browser smoke test
5. Story walkthroughs (e2e)
6. API probing
7. Recording evidence honestly

---

## 1. The evidence ladder

From weakest to strongest — always climb as high as the environment allows:

1. "I wrote the code" (no evidence)
2. Code compiles / typechecks
3. Unit tests pass
4. Integration tests pass against a real database
5. The app starts and health check responds
6. HTTP-level smoke: every route returns expected status
7. **Browser smoke: every page renders with no console errors; screenshots reviewed**
8. **E2E story walkthroughs: each must-have story completed through the UI**
9. Fresh-clone test: following only the README from an empty directory produces a working app

Production-level delivery requires level 8, and level 9 whenever feasible. If the
environment blocks a level, say which level you reached and why.

## 2. The verification loop

```text
for each gate:
  run checks  ──► all green? ──► record evidence, advance
       │
       └─► red: read the FIRST failure fully
              ├─ classify: my bug / test bug / environment / flaky
              ├─ my bug → fix root cause, add/keep the test, rerun
              ├─ test bug → fix the test ONLY if the test contradicts the spec (log why)
              ├─ environment → substitute or record constraint (ref 00 §6)
              └─ flaky → find the nondeterminism (time, order, network, race); never add sleeps
       budget exhausted → stuck protocol
```

Never: delete a failing test, mark it skipped, loosen an assertion to match wrong behaviour,
or catch-and-ignore the error to turn red into green.

## 3. Running the app for verification

- Start the app in the background with logs redirected to a file, using the production start
  command where possible (`npm run build && npm start`) — dev servers hide build-only errors.
- Wait for readiness by polling the health endpoint (bounded, e.g. 60 s), not by sleeping.
- Use a disposable database (fresh SQLite file, test schema, or container) and seed data.
- After testing, stop the process and check the log for errors/warnings you did not notice.

```bash
(npm run build && PORT=4010 npm start) > .autobuild/app.log 2>&1 &
APP_PID=$!
for i in $(seq 1 60); do curl -fsS localhost:4010/healthz >/dev/null && break; sleep 1; done
# ... run smoke + e2e ...
kill $APP_PID; grep -iE "error|unhandled|warn" .autobuild/app.log || true
```

## 4. Browser smoke test

```bash
node scripts/smoke_test.mjs --base-url http://localhost:4010 \
  --paths / /login /signup /app /settings /does-not-exist \
  --out .autobuild/screenshots
```

The script visits each path at desktop (1280×800) and mobile (375×812), and fails on:
console errors, uncaught page errors, failed network requests (≥ 400 other than the
expected 404 page), horizontal overflow, or visible placeholder text (`lorem ipsum`,
`undefined`, `NaN`, `[object Object]`). It writes a JSON + Markdown report.

Authenticated pages: pass `--login-path /login --email ... --password ...` with a seeded test
user, or provide a `--storage-state` file created by your e2e setup.

**Then read the screenshots** with the image viewer and apply the checklist in ref 19 §7.

## 5. Story walkthroughs (e2e)

Write one Playwright test per must-have story that follows its Given/When/Then exactly:

```ts
test("S-03 log a time entry", async ({ page }) => {
  await signIn(page, seed.users.alice);
  await page.getByRole("link", { name: "Time" }).click();
  await page.getByLabel("Client").selectOption({ label: "Acme" });
  await page.getByLabel("Duration").fill("1:30");
  await page.getByLabel("Note").fill("Logo revisions");
  await page.getByRole("button", { name: "Log time" }).click();
  await expect(page.getByRole("status")).toContainText("Time logged");
  await expect(page.getByRole("listitem").first()).toContainText("Logo revisions");
});
```

Use role/label selectors (they double as an accessibility check). Seed data through the
API or a seed script, not by clicking through setup every time.

## 6. API probing (the attacker's smoke test)

For every route, with curl or a script, confirm:
- No auth → 401; other user's resource → 404/403; malformed JSON → 400; schema-invalid → 400/422 with field details; oversized body → 413; unknown route → 404 JSON (for API); wrong method → 405.
- Responses never include stack traces, SQL, password hashes, tokens, or internal IDs that should be hidden.
- Security headers present (CSP, X-Content-Type-Options, Referrer-Policy, frame protection).

## 7. Recording evidence honestly

Write to `PROGRESS.md` and the delivery report in this form:

```text
Verification (level reached: 8 of 9)
- PASS  npm run lint                         (0 problems)
- PASS  npm run typecheck
- PASS  npm test                             (58 passed, 0 failed)
- PASS  smoke_test.mjs 7 paths × 2 viewports  (0 console errors, 0 failed requests)
- PASS  e2e: 6/6 stories
- SKIP  docker build — Docker daemon unavailable in this environment
- SKIP  fresh-clone test — no network for npm install from scratch
```

A SKIP with a reason is honest. A PASS you did not observe is a defect in the delivery.
