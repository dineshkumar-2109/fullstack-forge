# 08 — Performance, Scaling, and Reliability

## Measure first
Identify a user-visible latency or throughput target and measure representative workloads before optimizing. Use profiling, traces, query plans, load tests, and real production metrics where available.

## Common practices
- Set deadlines/timeouts for network, database, and model calls.
- Bound concurrency, queue size, request size, response size, and retries.
- Use bounded exponential backoff with jitter for transient failures.
- Apply circuit breakers or load shedding when they protect the system and are supported by operational maturity.
- Use caches only with clear keys, TTLs, invalidation, and privacy boundaries.
- Paginate and stream large results instead of loading unbounded data.
- Use background jobs for work that exceeds interactive latency budgets.
- Make background jobs idempotent and observable.
- Avoid retry storms and synchronized retry schedules.
- Use graceful degradation for optional dependencies; fail closed for security-sensitive checks.

## Capacity reasoning
Estimate request rate, concurrency, payload sizes, database load, queue throughput, provider quotas, and cost. Validate assumptions with load tests. Do not promise a fixed requests-per-second capacity without a defined workload and measurements.

## Example: retry policy
```text
Retry only transient network errors, 429s, and selected 5xx responses.
Maximum attempts: 3 total.
Use exponential backoff plus random jitter.
Respect Retry-After when valid.
Do not retry validation, authorization, or other permanent errors.
Use idempotency for writes before retrying them.
```
Tune values to the provider's limits and product latency budget.

## Reliability checklist
- [ ] Timeouts and budgets exist on external calls.
- [ ] Retry policy is bounded and error-aware.
- [ ] Writes are safe under duplicate delivery where required.
- [ ] Queues have backpressure and dead-letter/recovery policy where applicable.
- [ ] Cache invalidation and isolation are defined.
- [ ] Degraded modes and user-visible failure behavior are understood.
