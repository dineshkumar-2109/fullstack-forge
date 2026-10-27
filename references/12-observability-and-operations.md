# 12 — Observability and Production Operations

## Logs, metrics, and traces
Use structured logs with timestamp, severity, service, environment, request/correlation ID, and relevant operation identifiers. Keep logs useful but data-minimized. Use metrics for rates, errors, latency, saturation, queue depth, and business outcomes. Use distributed tracing for cross-service flows where justified.

## Privacy-safe logging
Never log passwords, authorization headers, API keys, session tokens, full payment details, or unnecessary sensitive user content. Redact or hash identifiers only where appropriate and approved. Restrict log access and retention. Avoid putting prompts, retrieved documents, or model responses into logs by default.

## Alerts and SLOs
Define user-impacting service-level indicators such as availability, latency percentiles, error rate, queue lag, and successful task completion. Alerts should be actionable, owned, and tied to runbooks. Avoid alerting on every transient event or using metrics with unbounded cardinality.

## Operational readiness
- Health/readiness checks and dependency visibility.
- Dashboards for core user journeys and expensive dependencies.
- Alert thresholds and clear ownership.
- Runbooks for common incidents.
- Backups, restore tests, and retention policy.
- Incident response and communication process.
- Rollback or mitigation path.

## Example structured log
```json
{
  "level": "info",
  "event": "order_created",
  "requestId": "req_example",
  "orderId": "ord_example",
  "durationMs": 42
}
```
Use synthetic IDs in examples. Do not log the full request body or secret-bearing headers.

## Incident response
Prioritize containment and user safety. Preserve relevant evidence without exposing secrets, communicate known facts, avoid speculative root causes, mitigate/rollback, verify recovery, and document follow-up actions. Do not claim recovery based only on a deployment command; verify health and user-facing behavior.
