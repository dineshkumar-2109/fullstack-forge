# 05 — Database and Data Engineering

## Schema design
- Model entities and relationships based on domain requirements.
- Choose primary keys, uniqueness, nullability, and foreign keys intentionally.
- Use constraints to protect invariants even if application code has bugs.
- Normalize by default; denormalize only for measured needs with a consistency strategy.
- Use indexes based on real query patterns and validate with query plans when possible.
- Define ownership/tenant columns and access paths explicitly.

## Queries and transactions
- Use parameterized queries or safe ORM APIs; never concatenate untrusted input into SQL.
- Select only required columns.
- Avoid N+1 queries and unbounded scans.
- Use transactions for logically atomic changes.
- Understand isolation and race conditions for counters, inventory, payments, and concurrent updates.
- Use optimistic concurrency or locks where appropriate.
- Do not rely on in-memory locks to coordinate multiple instances.

## Migrations and data safety
- Make schema changes through versioned migrations.
- Prefer backward-compatible expand/migrate/contract steps for zero-downtime deployments.
- Back up important data and test restore procedures.
- Avoid destructive production migrations without explicit approval, review, and recovery plan.
- Never use real production personal data in tests unless approved and appropriately protected.
- Define retention, deletion, export, and audit requirements for sensitive data.

## Example: parameterized query
Bad:
```sql
SELECT * FROM users WHERE email = '" + email + "';
```
Better (parameter syntax varies by driver):
```sql
SELECT id, email, display_name
FROM users
WHERE email = :email;
```

## Example: pagination
Prefer stable cursor pagination for large or frequently changing datasets. If using offset pagination, cap page size and define ordering explicitly:
```sql
SELECT id, created_at, status
FROM orders
WHERE owner_id = :owner_id
ORDER BY created_at DESC, id DESC
LIMIT :limit OFFSET :offset;
```
The owner filter must come from the authenticated server-side identity, not a caller-supplied owner ID.

## Database checklist
- [ ] Constraints represent important invariants.
- [ ] Queries are parameterized and scoped to the caller.
- [ ] Indexes match important query patterns.
- [ ] Migrations are reviewed and reversible where feasible.
- [ ] Backup and restore assumptions are documented.
- [ ] Retention and deletion behavior is defined.
