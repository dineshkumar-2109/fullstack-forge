# 00 — Autonomous Operating Mode

How to work for hours without a human, without going off the rails.

## Contents
1. The autonomy contract
2. Decide-or-ask: the decision rule
3. Default answers to common questions
4. The `.autobuild/` state directory
5. Budgets and loop control
6. Working with limited environments
7. Self-review: switching hats
8. Communicating while autonomous

---

## 1. The autonomy contract

The human handed over a goal, not a list of instructions. That means:

- **You own the outcome.** If the product does not run, it is not done — regardless of how much code exists.
- **You own the quality bar.** "They didn't ask for tests / error handling / accessibility" is not a reason to skip them. Production-level is the request.
- **You do not own irreversible or paid actions.** Those belong to the human (see hard stops in SKILL.md).
- **You leave a trail.** Anyone should be able to open `.autobuild/` and understand every important choice without asking you.

## 2. Decide-or-ask: the decision rule

For every open question, ask in order:

1. **Is it a hard stop?** (money, real credentials, production, real-people messaging, irreversible deletion, legal commitment, contradicts the user) → prepare everything, record in `BLOCKERS.md`, ask once with a concrete recommended answer. Continue with all other work meanwhile.
2. **Did the user already answer it** — explicitly or by clear implication (their stack, their example, their audience)? → Follow it.
3. **Does the repository already answer it** (existing conventions, libraries, patterns)? → Follow it.
4. **Is there an industry-default answer?** (see §3) → Take it.
5. **Otherwise** pick the option that is (a) cheapest to reverse, (b) simplest to operate, (c) most common in the ecosystem — in that priority.

Then log it:

```md
## D-007 — Use cursor pagination for /api/notes
- Context: lists can grow unbounded; UI uses infinite scroll.
- Options: offset (simple), cursor (stable under inserts).
- Decision: cursor on (created_at, id), page size default 20, max 100.
- Reversibility: high — internal to API, clients use opaque `nextCursor`.
- Source: rule 4 (industry default).
```

Assumptions (facts you could not verify) go in `ASSUMPTIONS.md` with a confidence level and how the human can correct them:

```md
- A-003 (medium): Users are individuals, not teams → single-owner data model.
  If teams are needed: add `workspace_id` + membership table (see BACKLOG B-12).
```

## 3. Default answers to common questions

| Question | Default when nothing else decides it |
|---|---|
| Stack? | See `17-greenfield-stack-selection.md` golden paths. |
| Auth method? | Email + password with secure sessions (HttpOnly cookies), password reset via email adapter; OAuth later. Use a maintained auth library where the stack has one. |
| Single- or multi-tenant? | Single owner per record (`owner_id`) unless the idea mentions teams/companies/workspaces → then `workspace_id` + roles. |
| Database? | PostgreSQL in production; SQLite acceptable for local/dev/tests only if the ORM abstracts it, or as the production DB for single-instance tools. |
| IDs? | Opaque random IDs (UUIDv7/ULID or prefixed random) in URLs; never sequential integers exposed publicly. |
| Money? | Integer minor units + ISO currency code. Never floats. |
| Time? | Store UTC (`timestamptz`); render in user's locale/timezone. |
| Deletion? | Soft delete for user content that may need recovery; hard delete for account deletion requests (privacy). |
| Pagination? | Cursor-based, default 20, max 100. |
| Styling? | The stack's mainstream choice (e.g. Tailwind for React) with a defined token set — see `19-ui-ux-quality.md`. |
| Email/SMS/payment providers? | Adapter interface + local fake implementation; real provider wiring documented but disabled until credentials exist. |
| Brand name, copy? | Invent a short, plausible name and clear, plain copy. No lorem ipsum anywhere. |
| License? | Do not choose one for the user's product; leave a note. For dependencies, prefer MIT/Apache-2.0/BSD. |
| Deployment target? | Container-first (Dockerfile) + docs for one mainstream PaaS. Do not deploy. |

## 4. The `.autobuild/` state directory

Created by `scripts/init_state.py`. It is the build's memory.

| File | Purpose | Update when |
|---|---|---|
| `PROGRESS.md` | Phase checklist, story checklist, last known-good command, current focus | After every slice and gate |
| `PRD.md` | Product spec (P1) | Scope changes |
| `ARCHITECTURE.md` | Stack, components, data model, API contract, env vars (P2) | Design changes |
| `DECISIONS.md` | Numbered decision log (D-001…) | Every non-trivial choice |
| `ASSUMPTIONS.md` | Unverified facts with confidence (A-001…) | When you assume |
| `BLOCKERS.md` | Hard stops and unresolved failures with exact human action needed | When blocked |
| `BACKLOG.md` | Cut scope, ideas, follow-ups (B-001…) | When you cut or defer |
| `quality-gate.md` | Last quality gate output (written by script) | Each gate run |
| `screenshots/` | Smoke-test screenshots | P5 |
| `DELIVERY.md` | Final report (P8) | End |

Rules: keep files short and current; replace stale content rather than appending forever.
Whether `.autobuild/` is committed is the user's choice — default to committing it, since it
documents the build; never put secrets in it.

## 5. Budgets and loop control

| Loop | Default budget | On exhaustion |
|---|---|---|
| Fix a failing test/build with the same approach | 3 attempts | Change approach |
| Alternative approaches to one problem | 2 | Stuck protocol step 4: isolate, log, move on |
| Visual polish iterations per screen | 2 | Accept, log remaining nits in BACKLOG |
| Dependency install retries (network) | 2 | Vendor/alternative/offline approach; record |
| Whole-feature effort vs. estimate | 2× | Re-scope: cut the feature's optional parts |

Signs you are looping: the same error text three times; reverting your own previous edit;
editing tests to match broken behaviour; adding `sleep`/retries to make a test pass;
silencing types with `any`/`# type: ignore`. Any of these → stop and apply the stuck protocol.

## 6. Working with limited environments

You will often lack something: no network to a registry, no Docker daemon, no database
server, no browser, no GPU.

- **Detect early** (P0) and record in `PROGRESS.md` → *Environment constraints*.
- **Substitute honestly:** SQLite/PGlite or an in-memory driver for tests when Postgres is absent; `docker build` not available → validate Dockerfile syntax by reading and document "not built"; no browser → HTTP-level smoke tests plus a note that visual review was not performed.
- **Never pretend.** The delivery report must list every verification that was substituted or skipped.

## 7. Self-review: switching hats

At each gate, re-read the work as a different role. Write the findings, then fix them.

| Hat | Asks |
|---|---|
| Product manager | Does each must-have story actually work end to end? Is anything confusing for a first-time user? Is there placeholder copy? |
| Staff engineer | Is it the simplest design? Duplicated logic? Leaky abstractions? Hidden coupling? Would I approve this PR? |
| Attacker | Which ID can I swap? Which input is unvalidated? What happens with 10 MB of JSON, `<script>`, `' OR 1=1`, negative quantities, 10,000 requests/minute? |
| On-call SRE | At 3 a.m., can I tell what broke from the logs? Is there a health check? What happens if the DB/provider is down? Can I roll back? |
| New developer | Can I run it in 5 minutes from the README? Are env vars documented? Do the scripts do what they say? |
| End user (mobile, keyboard, screen reader) | Does it work on a 375 px screen? Can I tab through it? Is every action labelled? |

If sub-agents are available, give one the **attacker** and **new developer** hats with no
knowledge of how you built it — fresh eyes find what the author cannot.

## 8. Communicating while autonomous

- Start with one sentence: what you are building and the mode.
- Send meaningful milestones only (spec ready, skeleton running, all stories done, hardened, delivered) — not every command.
- Raise hard stops immediately, with a recommended answer, then keep working on everything else.
- End with the delivery report. No victory laps; just evidence and next steps.
