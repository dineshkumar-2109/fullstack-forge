# 14 — Code Review and Debugging

## Review priorities
1. Correctness and requirement coverage.
2. Security, privacy, and authorization.
3. Data integrity and concurrency.
4. Failure handling and reliability.
5. Performance and resource usage.
6. Maintainability, clarity, and test quality.
7. Documentation and compatibility.

## Debugging method
- Reproduce the issue or identify a reliable failing test.
- Capture exact inputs, expected behavior, actual behavior, and environment.
- Inspect logs/traces and relevant code paths without exposing sensitive data.
- Form a hypothesis and test it with the smallest experiment.
- Fix the root cause rather than masking symptoms.
- Add regression coverage.
- Verify neighboring behavior and inspect the diff.

## Review findings
Classify findings by severity and explain the failure scenario and impact. Avoid vague comments such as “this is bad.” Prefer concrete suggestions. Do not nitpick formatting already handled by automated tooling unless it affects clarity.

## Example finding
```text
High — Resource ownership is not checked.
Scenario: User A changes the projectId in the request to a project owned by User B.
Impact: User A can read or modify another user's data.
Recommendation: Scope the query to the authenticated user's permitted projects and add a cross-user regression test.
```

## Avoid
- Guessing root cause from one symptom.
- Making unrelated refactors during a bug fix.
- Removing a failing test without understanding it.
- Saying “fixed” without running or explaining verification.
