# 04 — Backend and API Engineering

## Layering
Use the repository's established architecture. Where useful, separate route/controller concerns, application/use-case logic, domain rules, persistence, and external integrations. Keep HTTP concerns out of domain logic and keep database details out of unrelated modules.

## API contracts
- Use consistent resource naming, status codes, pagination, filtering, and error envelopes.
- Validate path, query, header, and body inputs with schemas or explicit validators.
- Define request/response contracts and avoid leaking internal database models.
- Return the minimum required data; avoid over-fetching sensitive fields.
- Use correct status semantics: validation errors, authentication failures, authorization failures, not found, conflict, rate limits, and server failures should be distinguishable according to the contract.
- Version breaking public APIs and document compatibility expectations.
- Set request size limits, timeouts, and rate limits appropriate to the endpoint.

## Authentication and authorization
Authentication answers who the caller is; authorization answers what that caller may do. Enforce authorization server-side on every protected resource and action. Scope database queries by tenant/owner where possible. Avoid IDOR/BOLA vulnerabilities from accepting arbitrary resource IDs.

## Reliability
- Use explicit timeouts for network calls.
- Retry only transient failures, with bounded exponential backoff and jitter.
- Avoid retries for non-idempotent operations unless idempotency is implemented.
- Use idempotency keys for operations that can be retried by clients or infrastructure.
- Apply transactions for related database changes and use an outbox or durable queue when coordinating database state with events.
- Propagate cancellation where supported.

## Example: consistent API error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "details": [{ "field": "email", "reason": "invalid_format" }],
    "requestId": "req_example"
  }
}
```
Do not include stack traces, secrets, raw SQL, or internal provider responses in public errors.

## Example: endpoint implementation outline
```text
1. Parse and validate request.
2. Authenticate caller.
3. Authorize action against the specific resource.
4. Execute application use case.
5. Persist changes transactionally where needed.
6. Map domain result to stable API response.
7. Emit structured logs/metrics without sensitive payloads.
```

## Backend checklist
- [ ] Validation occurs server-side.
- [ ] Authn and authz are distinct and enforced.
- [ ] Pagination and request limits prevent unbounded work.
- [ ] Timeouts and safe retry behavior are defined.
- [ ] Errors are stable and non-sensitive.
- [ ] API contract and tests are updated.
