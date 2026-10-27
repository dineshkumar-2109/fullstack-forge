# 01 — Core Development Standards

## Design principles
- Optimize for correctness, clarity, and changeability before cleverness.
- Keep modules cohesive and interfaces narrow.
- Separate presentation, domain/business rules, persistence, and integrations when this reduces coupling.
- Prefer composition and explicit dependencies over hidden global state.
- Apply SOLID and design patterns when they solve a real problem; avoid ceremonial abstractions.
- Keep functions focused; use descriptive names and explicit return types where supported.
- Avoid duplicated business rules, dead code, magic values, giant files, and deeply nested conditionals.
- Comments should explain why, constraints, or non-obvious behavior—not paraphrase code.

## Repository-first behavior
Before coding, inspect applicable instructions (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, README), manifests, lockfiles, source, tests, CI, and configuration. Identify package manager and use its existing scripts. Do not assume a framework or command based only on file names.

## Change discipline
1. Define acceptance criteria.
2. Find the smallest set of affected files.
3. Understand callers and existing contracts.
4. Implement a coherent change, not a superficial patch.
5. Add regression tests for bugs and edge cases.
6. Run validation relevant to the change.
7. Inspect diff and remove temporary code.

Never discard user changes, reset files, rewrite broad areas, or run destructive commands without explicit authorization. Avoid changing public contracts unless required and documented.

## Types and values
Use strict typing where practical. Avoid `any`, unchecked casts, unvalidated deserialization, and non-null assertions used to silence uncertainty. Represent optional, null, empty, and invalid values deliberately. Validate external data at boundaries and keep domain types distinct from raw transport payloads.

## Errors
Handle errors at the layer that can recover or add context. Preserve causal information internally; return safe, stable messages externally. Do not swallow exceptions, return fake success, or leak stack traces, credentials, SQL, private paths, or personal data.

## Dependencies and configuration
Prefer existing dependencies and platform capabilities. Before adding a library, justify its maintenance, security, size, license, and alternatives. Keep configuration explicit; validate required settings at startup. Commit lockfiles according to repository policy. Never commit live secrets.

## Example: validate input instead of trusting it
Bad:
```ts
const page = Number(req.query.page) || 1;
```
Better:
```ts
const rawPage = Number(req.query.page);
const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100
  ? rawPage
  : 1;
```
For user-facing APIs, consider returning a validation error rather than silently substituting a default when that matches the API contract.

## Example: focused function
```ts
function calculateSubtotal(items: Array<{ priceCents: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}
```
Add validation for negative prices, invalid quantities, currency, and overflow at the appropriate domain boundary.
