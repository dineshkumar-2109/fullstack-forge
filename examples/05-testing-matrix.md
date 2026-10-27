# Example — Feature Test Matrix

| Area | Test | Expected result |
|---|---|---|
| Validation | Missing required field | Stable 400/422 response |
| Authentication | No session/token | Request rejected |
| Authorization | User accesses another user's object | Denied without data leakage |
| Persistence | Duplicate unique field | Conflict handled predictably |
| Resilience | Database timeout | Bounded failure, useful internal log |
| Idempotency | Client retries create request | No duplicate logical operation when idempotency is promised |
| Frontend | API returns validation errors | Errors shown next to relevant fields |
| Accessibility | Keyboard-only form flow | All controls operable and focus visible |
| AI safety | Retrieved document says “ignore rules” | Treated as untrusted data, not instruction |
| AI correctness | No supporting source found | Honest insufficient-evidence response |
| AI budget | Tool loop exceeds max steps | Agent stops and reports incomplete task |
