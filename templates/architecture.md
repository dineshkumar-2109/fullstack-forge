# Architecture — [Product name]

## Stack
| Layer | Choice | Decision ref |
|---|---|---|
| Frontend | | D-… |
| API | | |
| Database | | |
| Auth | | |
| Jobs/queue | | |
| Hosting (documented, not deployed) | | |

## Component diagram
```
[Browser] ──HTTPS──► [App/API] ──► [DB]
                         ├──► [Queue/worker]
                         └──► [Adapters: email | payments | storage | LLM]  (fake in dev/test)
```

## Data model
| Table | Key columns | Constraints | Indexes | Owner/tenant column |
|---|---|---|---|---|
| | | | | |

## API contract
| Method | Path | Auth/role | Request schema | Response | Errors |
|---|---|---|---|---|---|
| | | | | | |
Error envelope: `{ "error": { "code", "message", "details?", "requestId" } }`

## Story → implementation map
| Story | Routes | Tables | Screens | Tests |
|---|---|---|---|---|
| S-01 | | | | |

## External dependencies (adapters)
| Capability | Interface | Dev/test fake | Real provider (env vars) | Hard stop? |
|---|---|---|---|---|
| | | | | |

## Environment variables
| Name | Required | Default | Secret? | Description |
|---|---|---|---|---|

## Data inventory (privacy)
| Data | Stored where | Purpose | Sensitivity | Retention | Access |
|---|---|---|---|---|---|

## Background jobs
| Job | Trigger | Idempotency key | Retries | Dead-letter handling |
|---|---|---|---|---|
