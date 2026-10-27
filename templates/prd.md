# PRD — [Product name]

## Problem
[Who struggles with what today? What do they use instead, and why does it hurt?]

## Primary user
[One persona, one sentence.]

## Core loop
[The action users repeat: e.g. capture → organize → act → review]

## Activation moment
[What a new user achieves in their first minutes that proves value.]

## Scope
**Must** (4–8 stories — the product is unusable without each)
- S-01 …
**Should** (deferred to BACKLOG unless time allows)
- …
**Won't (this build)**
- …

## Stories and acceptance criteria
### S-01 [Title] (Must)
As a [user], I want [capability] so that [outcome].
- Given … When … Then …            (happy path)
- Given invalid input … Then …      (validation, field-level)
- Given another user's resource … Then 404, nothing changes   (authorization)
- Empty state: …
- Double submit / retry: …
Data: [tables/columns] · API: [routes] · UI: [screens]

## Implied features included
[From references/16 §4 for this product type — list what is in and what is deferred.]

## Non-functional requirements
| Area | Target |
|---|---|
| Performance | |
| Security | |
| Accessibility | |
| Privacy | |
| Availability/ops | |

## Success metrics
[Activation rate, core-loop frequency, error rate…]

## Risks and hard stops
[Regulated data? Payments? Real messaging? Each with adapter + fake plan.]
