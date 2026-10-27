# 16 — Product Discovery and Spec (Idea → PRD)

How to turn "build me a habit tracker" into a spec precise enough to build and test.

## Contents
1. Expand the idea
2. Scope the MVP
3. Write stories with acceptance criteria
4. Implied features by product type
5. Non-functional requirements defaults
6. Spec quality checklist

---

## 1. Expand the idea

Answer these in the PRD (decide where the user did not say; log in DECISIONS/ASSUMPTIONS):

- **Who** is the primary user? One persona, one sentence. ("Freelance designer tracking billable hours across 3–10 clients.")
- **What job** are they hiring the product to do? ("Know what to invoice each client at month end without spreadsheets.")
- **What do they use today** and what hurts? This tells you the must-have bar.
- **What is the core loop?** The action the user repeats (log time → see totals → export invoice). The MVP is built around the loop.
- **What does success look like** for the user in their first 5 minutes? (Activation moment.)
- **What are the risks?** Data sensitivity, money movement, abuse potential, regulated domain.

## 2. Scope the MVP (MoSCoW)

- **Must:** the core loop end to end + implied essentials (§4). If any must is missing, the product is not usable.
- **Should:** makes it pleasant (search, sort, bulk actions, dark mode).
- **Could:** nice later (integrations, analytics, AI features unless AI *is* the product).
- **Won't (this build):** written down explicitly so nobody thinks it was forgotten.

Rule of thumb for an autonomous build: 4–8 must-have stories. More than ~10 means the
scope is too broad — cut to the core loop and move the rest to BACKLOG.

## 3. Write stories with acceptance criteria

Format:

```md
### S-03 Log a time entry (Must)
As a freelancer, I want to log time against a client so that I can invoice accurately.

Acceptance criteria
- Given I am signed in and have a client "Acme"
  When I submit 1h30m for Acme dated today with note "Logo revisions"
  Then the entry appears at the top of today's list and Acme's monthly total increases by 1.5h
- Given duration is 0, negative, or > 24h → the form shows a field error and nothing is saved
- Given I submit a client ID belonging to another user → 404, nothing saved
- Given I double-click submit → exactly one entry is created
- Empty state: with no entries, the list shows guidance and a primary "Log time" action

Data: time_entries(id, owner_id, client_id, started_on, minutes, note, created_at)
API: POST /api/time-entries, GET /api/time-entries?cursor=
UI: /time (list + form)
```

Every criterion must be testable by an automated test. Include at least: happy path,
validation failure, authorization failure, and empty state for each story with data.

## 4. Implied features by product type

Users never ask for these, but notice instantly when they are missing.

**Every product with accounts**
- Sign up, sign in, sign out, password reset, session expiry handling
- Account settings: change email/password, delete account (and its data)
- Data export (at least JSON/CSV of the user's own data)
- 404 page, generic error page, offline/network-error message
- Empty states for every list; loading states for every async view
- Basic legal pages as clearly marked placeholders (Terms, Privacy) — see ref 21
- Favicon, page titles, meta description, social preview image placeholder

**SaaS / B2B**
- Workspaces/teams, invitations, roles (owner/admin/member), member removal
- Audit log of sensitive actions; plan/billing page (adapter + test mode)
- Onboarding checklist or first-run guidance; seed/demo data option

**Marketplace / e-commerce**
- Catalog, search/filter, cart, checkout (payment adapter, idempotent), order history, order status emails
- Inventory/stock rules under concurrency; refunds/cancellation path; admin order management
- Tax/shipping as configurable stubs with clear notes

**Content / social / community**
- Create/edit/delete own content; moderation (report, hide, admin review); rate limits on posting
- Sanitized rich text; image upload with size/type limits; pagination/infinite scroll
- Block/mute; notification preferences

**Booking / scheduling**
- Timezone correctness everywhere; double-booking prevention (DB constraint/transaction)
- Reminders (job + email adapter); cancellation/reschedule rules; calendar export (ICS)

**Internal tool / dashboard**
- Role-based access; audit log; CSV import with validation report; CSV export
- Filters persisted in URL; large-table pagination; charts with empty/no-data states

**AI / LLM product**
- Streaming responses with stop/cancel; conversation history scoped per user; regenerate
- Usage limits and cost tracking per user; graceful provider failure message
- Feedback (thumbs up/down) stored for evals; prompt/model versioning; refs 10–11

**Public API / developer product**
- API keys (hashed at rest, shown once, revocable, scoped); rate limits with headers
- OpenAPI spec; versioned routes; idempotency keys on POST; webhooks with signatures + retries

**Landing / marketing site**
- Fast (static where possible), responsive, accessible; SEO meta, sitemap, robots.txt
- Contact/waitlist form with spam protection and server validation; analytics adapter (privacy-respecting)

## 5. Non-functional requirements defaults

Write these into the PRD unless the user gave different targets:

| Area | Default target |
|---|---|
| Performance | p95 API < 300 ms for CRUD on seed data; LCP < 2.5 s on a mid-range phone for main pages |
| Availability design | Single region, stateless app instances, managed DB with backups |
| Security | OWASP ASVS L1 baseline; server-side authz on every object; rate-limited auth endpoints |
| Accessibility | WCAG 2.2 AA basics: labels, keyboard, focus visible, contrast ≥ 4.5:1 |
| Browser support | Last 2 versions of evergreen browsers; responsive from 360 px |
| Privacy | Collect minimum PII; export + delete supported; no PII in logs |
| Data | Daily backups (documented, provider-managed); migrations forward-only with expand/contract |
| Observability | Structured logs with request ID; health + readiness endpoints; error tracking adapter |

## 6. Spec quality checklist

- [ ] One primary persona and one core loop named
- [ ] 4–8 must-have stories, each with testable Given/When/Then incl. failure cases
- [ ] Implied features for the product type considered and either included or explicitly deferred
- [ ] Explicit "Won't" list
- [ ] Non-functional targets written
- [ ] Every assumption recorded with confidence
- [ ] No hard-stop dependency left without an adapter + fake plan
