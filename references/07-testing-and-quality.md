# 07 — Testing and Quality Engineering

## Testing pyramid
- **Unit tests:** deterministic domain logic, validators, transformations, and edge cases.
- **Integration tests:** database repositories, API boundaries, queues, caches, and provider adapters.
- **End-to-end tests:** a small number of critical user journeys.
- **Contract tests:** compatibility between API producers and consumers where useful.
- **Security tests:** authorization boundaries, injection handling, unsafe uploads, rate limits, and secret redaction.

## Test quality
- Test behavior and public contracts rather than implementation details.
- Include happy paths, invalid input, empty values, boundary values, authorization failures, dependency failures, and concurrency where relevant.
- Use deterministic fixtures, fake clocks, seeded randomness, and isolated test data when appropriate.
- Avoid flaky sleeps and dependence on uncontrolled external services.
- Tests should fail for the bug they are intended to catch.
- Add regression coverage for fixed defects.
- Never weaken or delete meaningful tests merely to make a build pass.

## Verification
Use scripts and tools actually available in the repository. Prefer focused tests first, then broader tests/builds if practical. Record failures accurately and distinguish pre-existing failures from introduced failures when evidence supports that distinction.

Example verification report:
```text
Passed: `npm run lint`
Passed: `npm test -- auth.test.ts`
Not run: full end-to-end suite (requires local services not available)
Known limitation: integration tests need TEST_DATABASE_URL
```
Only use this format with actual results.

## Example test matrix
| Scenario | Expected result |
|---|---|
| Valid owned resource | 200 and expected fields |
| Missing authentication | 401 or contract-defined response |
| Authenticated but unauthorized | 403 or non-disclosing 404 |
| Invalid field | 400/422 with safe details |
| Dependency timeout | bounded failure, no hanging request |
| Duplicate retry | one logical operation when idempotency is required |

## Quality gates
Run formatting, lint, type checking, relevant tests, build, and migration validation as supported. Avoid claiming a quality gate passed when it was skipped or unavailable.

## Test data and isolation
- Use factories/builders for test data (`makeUser({ email })`) instead of large shared fixtures.
- Each test owns its data; tests must pass in any order and in parallel.
- Use a fresh database (or transaction rollback) per test file; never test against a shared developer database.
- Inject the clock and random/ID generators where behaviour depends on them.

## Coverage guidance
Coverage percentage is a smoke alarm, not a goal. Aim for every acceptance criterion and every
authorization rule to have at least one test; services and validators near-fully covered; thin
glue code may be covered by integration tests only.
