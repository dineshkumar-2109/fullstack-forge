# 02 — Requirements, Architecture, and Planning

## Convert requests into acceptance criteria
Capture:
- User and business goal.
- Main user flows and permissions.
- Inputs, outputs, validation, and error states.
- Data entities, ownership, retention, and migration needs.
- Non-functional needs: latency, traffic, availability, accessibility, privacy, budget, and compliance.
- Explicit out-of-scope behavior.

Use Given/When/Then when it clarifies behavior:
```text
Given an authenticated user owns a project
When they request that project
Then the API returns its data
And a different user's request returns a non-disclosing 404 or policy-defined 403.
```

## Architecture decisions
- Start with a modular monolith unless independent scaling, team ownership, deployment cadence, or isolation justify services.
- Define module boundaries by business capability and stable contracts.
- Use synchronous calls for immediate responses and asynchronous queues for deferred/retryable work.
- Document important decisions and trade-offs in short ADRs.
- Draw the request/data flow when a feature crosses frontend, API, database, queue, and external providers.
- Identify failure modes, sensitive data, trust boundaries, and rollback strategy before high-risk changes.

## Planning template
1. Goal and acceptance criteria.
2. Current behavior and relevant files.
3. Proposed approach and alternatives.
4. API/schema/config changes.
5. Security and privacy considerations.
6. Tests and verification commands.
7. Deployment/migration/rollback considerations.

Do not over-plan small fixes. Do not start a broad implementation while critical requirements remain unresolved.
