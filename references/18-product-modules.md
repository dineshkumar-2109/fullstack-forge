# 18 — Product Modules: Proven Patterns

Building blocks almost every product needs. Each module lists: data model, rules,
the adapter boundary (for hard-stop dependencies), and the tests that prove it.

## Contents
1. Authentication and sessions
2. Authorization and multitenancy
3. Billing and payments
4. Email and notifications
5. File uploads
6. Background jobs and scheduling
7. Search
8. Audit log
9. Admin area
10. Feature flags and configuration
11. API keys and webhooks
12. Internationalization, SEO, analytics
13. Rate limiting and abuse prevention

---

## 1. Authentication and sessions

**Prefer the stack's maintained auth library.** If you must implement sessions:
- Passwords: Argon2id (preferred), scrypt, or bcrypt (cost ≥ 12) via a maintained library. Minimum length 8 (better 10–12), max length ~128 to bound hashing cost, check against a breached-password list if available. No composition rules.
- Sessions: 256-bit random token in an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie. Store only a **hash** of the token server-side with `user_id`, `expires_at`, `created_at`, `last_seen_at`, `user_agent`. Rotate on login and privilege change. Idle timeout + absolute timeout.
- Login: same error message and similar timing for unknown email vs wrong password. Rate limit by IP and by account. Lockout via progressive delay, not permanent lock.
- Password reset: single-use random token (hash stored), 30–60 min expiry, invalidates other sessions on success, response identical whether the email exists or not.
- Email verification: same token pattern; restrict sensitive actions until verified if relevant.
- Sign-out: delete the server-side session, clear the cookie.
- CSRF: SameSite=Lax plus an origin check (or CSRF token) for state-changing requests on cookie auth.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
```
Store emails normalized (trim + lowercase) and enforce uniqueness case-insensitively.

**Tests:** sign up → sign in → access protected → sign out → access denied; wrong password; unknown email same response; expired session; reset token reuse rejected; rate limit triggers.

## 2. Authorization and multitenancy

- Model: `workspaces`, `memberships(workspace_id, user_id, role)`, and `workspace_id` on every tenant-owned table.
- One function decides access: `can(actor, action, resource)`. Call it in services, not only in routes.
- **Every repository query includes the tenant/owner predicate.** A query without it is a bug. Consider Postgres Row-Level Security as defence in depth for multitenant SaaS.
- Return 404 (not 403) for resources in other tenants to avoid existence disclosure — unless the API contract says otherwise.
- Roles: start with owner/admin/member. Owner can't be removed without transferring ownership.
- Invitations: random token, expiry, bound to email, single use.

**Tests:** the IDOR matrix — for every resource route, user B attempts read/update/delete of user A's resource → 404 and no change. This is the single most valuable security test in most products.

## 3. Billing and payments (hard-stop dependency)

- Build a `BillingProvider` interface: `createCheckout`, `createPortalSession`, `parseWebhook`. Implement `FakeBillingProvider` (instant success, local) and document the real provider (e.g. Stripe) wiring with env vars left empty.
- Source of truth for entitlement = your DB (`subscriptions(workspace_id, plan, status, current_period_end, provider_customer_id, provider_subscription_id)`), updated from **verified webhooks**, not from the client redirect.
- Webhooks: verify signature, store event ID for idempotency (unique constraint), process in a transaction, return 2xx quickly, retry-safe.
- Money: integer minor units + currency. Never trust client-sent prices — look up price server-side.
- Checkout/creating orders: idempotency key per attempt.

**Tests:** webhook with bad signature rejected; duplicate webhook processed once; plan limits enforced server-side; downgrade/cancel path.

## 4. Email and notifications (hard-stop dependency)

- `Mailer` interface with `ConsoleMailer`/`FileMailer` (writes to `.tmp/mail/*.eml` or logs) for dev/test and a real provider adapter disabled by default.
- Templates: plain-text + HTML, variables escaped, unsubscribe link for non-transactional mail.
- Send asynchronously via a job; record `notifications(id, user_id, type, status, attempts, sent_at)`.
- Respect user notification preferences; never email from inside a DB transaction (use outbox).

**Tests:** reset email "sent" via fake adapter contains a working link; failures retried with backoff; preferences respected.

## 5. File uploads

- Validate size (server-enforced), count, and type by **content sniffing**, not just extension/MIME header.
- Store outside the web root / in object storage with random keys; never use user filenames as paths.
- Serve via signed, expiring URLs or an authorized download route with `Content-Disposition: attachment` for untrusted types; set `X-Content-Type-Options: nosniff`.
- Images: re-encode/strip metadata (EXIF GPS) and generate sizes in a background job.
- `StorageProvider` interface with `LocalDiskStorage` for dev and an S3-compatible adapter documented.

**Tests:** too-large rejected; disguised executable rejected; user B cannot fetch user A's file; path traversal filename harmless.

## 6. Background jobs and scheduling

- Use a durable queue (DB-backed is fine at MVP scale). Jobs must be **idempotent**, have a max attempts count, exponential backoff, and a dead-letter state you can inspect.
- Transactional outbox for "save X and then send event/email": write the outbox row in the same transaction; a worker publishes it.
- Scheduled jobs: one leader (DB lock / queue scheduler), not `setInterval` on every instance.
- Record job metrics: enqueued, succeeded, failed, latency.

## 7. Search

- Start with the database: Postgres full-text search (`tsvector` + GIN index) or `ILIKE` with trigram index for small datasets. Always tenant-scoped.
- Escape/parameterize search input; cap query length; paginate.
- Move to a dedicated engine only with measured need.

## 8. Audit log

- Append-only `audit_events(id, workspace_id, actor_id, action, target_type, target_id, metadata_json, ip, user_agent, created_at)`.
- Record: sign-in, password/email change, role change, invite, delete, export, billing changes, admin actions, API key create/revoke.
- No secrets or full payloads in metadata. Visible to workspace admins.

## 9. Admin area

- Separate role check (`is_staff`/`admin` role) enforced server-side on every admin route; consider a separate path prefix and stricter session timeout.
- Read-mostly views, search by email/ID, and safe actions (disable user, resend verification). Every admin action audited.
- Impersonation only with explicit audit and visible banner — or not at all for MVP.

## 10. Feature flags and configuration

- Config: parse and validate **all** env vars at startup with a schema; crash with a clear message listing missing/invalid keys. Export a typed config object; never read `process.env` elsewhere.
- Flags: a simple table or config map with per-workspace overrides is enough for MVP. Flags default to "off" for unfinished/hard-stop features.

## 11. API keys and webhooks (developer products)

- API keys: prefix (`sk_live_`, `sk_test_`) + 32 random bytes; store hash only; show once; last-used timestamp; scopes; revoke.
- Outbound webhooks: sign payloads (HMAC-SHA256 with timestamp), retry with backoff, record deliveries, let users rotate secrets, and protect against SSRF when delivering to user URLs.

## 12. Internationalization, SEO, analytics

- i18n: externalize strings from day one if more than one locale is plausible; format dates/numbers/currency with `Intl`; store UTC.
- SEO (public pages): unique `<title>` and meta description, canonical URL, Open Graph tags, `sitemap.xml`, `robots.txt`, semantic headings, fast LCP. Authenticated pages: `noindex`.
- Analytics: `Analytics` adapter with a no-op default; track a handful of product events (signup, activation, core action) without PII; respect consent where required (ref 21).

## 13. Rate limiting and abuse prevention

| Endpoint class | Starting limit (tune per product) |
|---|---|
| Sign-in / sign-up / reset | 5–10 per minute per IP and per account |
| Authenticated writes | 60 per minute per user |
| Authenticated reads | 300 per minute per user |
| Expensive (export, AI calls, uploads) | Explicit per-user quota + concurrency cap |

Return 429 with `Retry-After`. In-memory limiters are acceptable only for single-instance
deployments — document the swap to a shared store (Redis/DB) for horizontal scaling.
Add bot protection (honeypot field, or CAPTCHA adapter) on public forms.
