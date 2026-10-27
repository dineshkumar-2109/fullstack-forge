# Example — Red-Team Findings (P6)

Write findings in this format, fix them, and turn each into a regression test.

```text
ID: RT-01            Severity: High
Title: Task update does not check project ownership
Scenario: Mallory sends PATCH /api/tasks/tsk_ALICE with {"version":1,"title":"pwned"}.
Impact: Any user can modify any task whose ID they learn (IDOR/BOLA).
Evidence: 200 OK and Alice's task title changed (test log).
Fix: Repository UPDATE filters by owner_id from the session; 0 rows → 404.
Regression test: tests/security.test.js "another user gets 404 (not 403) for every route and nothing changes"
Status: Fixed, verified.
```

## Typical findings checklist (run every one)

| # | Probe | Expected | Tasklane result |
|---|---|---|---|
| 1 | Swap every resource ID for another user's (GET/PATCH/DELETE/child create) | 404, unchanged | 7/7 routes pass |
| 2 | Add `ownerId`, `id`, `role` to bodies | 400 `unknown_field` | Pass |
| 3 | `<img src=x onerror=…>` in every text field, then view it in the UI | Rendered as text | Pass (API + e2e) |
| 4 | `' OR '1'='1`, `'); DROP TABLE …; --` | Stored literally | Pass |
| 5 | 5 MB body / non-JSON content type / broken JSON | 413 / 415 / 400 | Pass |
| 6 | Numbers/arrays/null where strings are expected; control characters | 400 with field details | Pass |
| 7 | State change with `Origin: https://evil.example` / `Sec-Fetch-Site: cross-site` | 403 | Pass |
| 8 | 5 sign-ins in a minute with limit 3 | 401,401,401,429,429 + Retry-After | Pass |
| 9 | Replay a cookie after sign-out; use a cookie after expiry | 401 | Pass |
| 10 | `/../package.json`, `%2e%2e`, `/src/config.js` on the static server | 404, no source leak | Pass |
| 11 | Error responses for unknown IDs | No SQL/stack/paths; has requestId | Pass |
| 12 | Logs after a sign-up and a request with `?token=…` | No password, no query string | Pass |
| 13 | Security headers on API, HTML, 404 and error responses | CSP, nosniff, DENY, no X-Powered-By | Pass |

## Severity guide
- **Critical:** auth bypass, cross-tenant data access at scale, RCE, secret exposure.
- **High:** IDOR on a single resource type, stored XSS, missing CSRF on sensitive actions.
- **Medium:** missing rate limit on auth, verbose errors, weak session settings.
- **Low:** missing non-critical header, minor information disclosure.

Gate P6 passes only with zero open Critical/High findings.
