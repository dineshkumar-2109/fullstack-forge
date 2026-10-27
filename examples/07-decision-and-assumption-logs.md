# Example — Decision and Assumption Logs

Autonomy is only acceptable if it is auditable. These logs are how a human reviews hours of
work in minutes.

## Good decision entries

```md
## D-004 — scrypt N=2^15 for passwords
- Context: no native modules allowed (D-001); login latency budget ~150 ms on a small instance.
- Options: bcryptjs (pure JS, slower), argon2 (native), Node scrypt (built-in).
- Decision: Node scrypt N=2^15, r=8, p=1, per-user 16-byte salt, timing-safe compare.
- Trade-off: OWASP prefers N=2^17 → B-006 raises it once hardware is known.
- Reversibility: high — hash format is self-describing (`scrypt$N$r$p$salt$hash`), old hashes keep verifying.
- Source: judgement.
```

```md
## D-008 — Duplicate sign-up returns 409
- Context: reveals that an email is registered (account enumeration).
- Decision: accept for MVP; sign-in errors and rate limits stay uniform.
- Revisit: when email verification exists (B-002) switch to "check your inbox" for both cases.
- Source: judgement (UX vs. low-severity disclosure).
```

Why these are good: the context explains *why a choice was needed*, alternatives are named,
the trade-off is explicit, and there is a path to change it.

## Bad decision entries (and why)

| Entry | Problem |
|---|---|
| "Used Postgres." | No context, no alternatives, no reason. Useless to a reviewer. |
| "Decided to skip auth for now." | That is a scope cut of a must-have — belongs in BACKLOG with a reason, and probably violates the PRD. |
| "Chose Stripe and created a live account." | Hard stop violated: spending money and real credentials require the human. |
| "Will use Redis because it's faster." | Speculative; no measured need; adds an operational dependency (ref 17 §6). |

## Good assumption entries

```md
- A-002 (medium): One app instance is enough for launch traffic.
  If wrong: move to PostgreSQL + shared rate limiter (runbook "Scaling notes"), ~1 day of work.
- A-004 (high): Due dates are calendar dates with no time zone; "overdue" uses the viewer's local date.
```

Every assumption has a confidence level and tells the human what to do if it is wrong.
Low-confidence assumptions that affect data models or security should be surfaced in the
delivery report's first screen, not buried.

## Hard-stop entry (BLOCKERS.md)

```md
## H-001 — Email provider (hard stop: real credentials, real messages)
- Blocks: password reset, email verification (B-001, B-002).
- Human action: choose a provider, create an API key, set MAIL_FROM and MAIL_API_KEY.
- Fallback in place: feature hidden in the UI; no dead links; Mailer interface + console fake ready.
```

A hard stop never stalls the build: prepare everything up to the line, build a fake behind
the adapter, hide the unfinished UI, and tell the human exactly what to do.
