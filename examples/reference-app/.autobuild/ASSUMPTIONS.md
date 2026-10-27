# Assumptions

- A-001 (high): Single user per account; no sharing. If teams are needed → workspace_id + memberships (ref 18 §2), B-004.
- A-002 (medium): One app instance is enough for launch traffic. If not → PostgreSQL + shared rate limiter (runbook "Scaling notes").
- A-003 (medium): Users accept that password reset is not yet available. Blocked on an email provider (BLOCKERS H-001).
- A-004 (high): Due dates are calendar dates without time zones; "overdue" is computed in the viewer's browser.
