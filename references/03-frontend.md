# 03 — Frontend Engineering

## Component design
- Components should have a clear responsibility and explicit props.
- Separate reusable UI from domain-specific orchestration when that improves clarity.
- Keep business rules out of presentational components where possible.
- Avoid giant components, prop drilling across many layers without reason, and premature global state.
- Use local state by default; use context/state libraries for genuinely shared state; use server-state tools for remote data where already adopted.
- Avoid duplicating server state in client state without a clear synchronization policy.

## UX states
Every async screen should consider loading, success, empty, error, and retry states. Prevent duplicate submissions where necessary. Give actionable feedback and preserve user input when safe. Confirm destructive actions and make irreversible consequences clear.

## Accessibility
- Use semantic HTML and native controls.
- Ensure keyboard navigation, visible focus, labels, accessible names, and sensible focus order.
- Associate validation errors with fields and announce important status updates appropriately.
- Do not convey state through color alone.
- Respect reduced-motion preferences and maintain usable contrast.
- Add alt text for meaningful images; decorative images should not create noise for assistive technology.

## Forms and validation
- Validate on the client for usability and on the server for security.
- Normalize input only when the domain permits it; do not silently alter meaningful values.
- Show field-level errors and summary-level errors when useful.
- Handle server validation errors and stale/expired sessions.

## Data fetching and security
- Keep secrets and privileged credentials on the server.
- Do not trust hidden fields, disabled controls, route guards, or client role checks as authorization.
- Cancel or ignore stale requests where needed; handle race conditions and unmounts.
- Avoid rendering untrusted HTML. If HTML rendering is necessary, sanitize with a maintained library and define a narrow policy.
- Avoid logging tokens, personal data, or full sensitive payloads in browser consoles.

## Performance
- Measure before optimizing.
- Avoid unnecessary re-renders, oversized bundles, duplicate requests, unbounded lists, and large synchronous work on the main thread.
- Use pagination/virtualization for large lists where appropriate, lazy-load expensive routes, optimize images, and cache with explicit invalidation rules.
- Ensure caching does not expose one user's data to another.

## Example: accessible form field
```jsx
<label htmlFor="email">Email address</label>
<input id="email" name="email" type="email" autoComplete="email" required aria-describedby="email-error" />
<p id="email-error" role="alert">Enter a valid email address.</p>
```
Only render the error message when the field has an error; keep error state tied to validation results.

## Frontend completion checklist
- [ ] Responsive layout and important viewport sizes checked.
- [ ] Loading, empty, error, and success states handled.
- [ ] Keyboard and screen-reader basics checked.
- [ ] Client validation and server errors handled.
- [ ] Authorization enforced by backend, not only UI.
- [ ] No secrets or sensitive debug output.
- [ ] Tests cover meaningful interactions.
