# 15 — Delivery Checklists

## Before implementation
- [ ] Acceptance criteria are clear.
- [ ] Existing patterns and instructions inspected.
- [ ] Affected layers and contracts identified.
- [ ] Data migration, permissions, and external dependencies considered.
- [ ] High-risk assumptions clarified.

## Before completion
- [ ] Requested behavior implemented.
- [ ] Edge cases and failures handled.
- [ ] Authorization and data ownership verified server-side.
- [ ] Tests added/updated for meaningful behavior.
- [ ] Formatting, lint, types, tests, and build run where available.
- [ ] Diff checked for unrelated changes, secrets, debug code, and generated files.
- [ ] Documentation and `.env.example` updated where necessary.
- [ ] Migration and rollback risks considered.
- [ ] Final response accurately reports checks and limitations.

## AI/LLM feature checklist
- [ ] Data classification and provider permissions reviewed.
- [ ] Model output schema validated.
- [ ] Retrieval source access controls enforced.
- [ ] Prompt injection and unsafe tool use tested.
- [ ] Token, time, concurrency, and spend budgets defined.
- [ ] Citations and groundedness verified where applicable.
- [ ] Failure, timeout, refusal, and provider outage paths tested.
- [ ] Sensitive content excluded from logs by default.

## Final response template
```text
Implemented
- [Concise description of changes and important files.] 

Verification
- Passed: [commands actually run and passed]
- Failed: [commands run and failed, with relevant reason]
- Not run: [important checks not run and why]

Notes / risks
- [Migration, configuration, security, or operational caveats]

Next steps
- [Only concrete remaining actions, if any]
```

## Autonomous build gates (summary)
| Gate | Pass condition | Evidence |
|---|---|---|
| P0 | Mode + constraints recorded; `.autobuild/` exists | PROGRESS.md |
| P1 | PRD with 4–8 must-have stories, testable criteria | PRD.md |
| P2 | Every story mapped to routes/tables/screens; threat model | ARCHITECTURE.md |
| P3 | Skeleton runs; quality gate green | quality-gate.md, health check output |
| P4 | All must-have stories implemented and tested | test output |
| P5 | Smoke clean; stories walked through UI; screenshots reviewed | smoke report, screenshots |
| P6 | No open high/critical findings; secret scan clean | findings list, scan output |
| P7 | Readiness audit ≥ 90, no failed critical check; README verified | audit output |
| P8 | Honest delivery report | DELIVERY.md |
