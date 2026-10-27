# 06 — Application Security and Privacy

## Security baseline
Use a defense-in-depth approach and follow the framework's secure defaults. Consider OWASP guidance relevant to the application's architecture. Security requirements are part of acceptance criteria, not a final optional pass.

## Identity and access
- Store passwords using a reputable password-hashing algorithm and maintained library; never reversible encryption or plain text.
- Prefer established authentication/session libraries and secure defaults.
- Protect cookies with `HttpOnly`, `Secure` in HTTPS, and an appropriate `SameSite` setting.
- Protect state-changing cookie-authenticated requests against CSRF.
- Rotate, expire, and revoke sessions/tokens according to risk.
- Enforce least privilege and deny by default.
- Check access to each object and action server-side; test cross-user and cross-tenant access.
- Require stronger confirmation or re-authentication for sensitive account changes when appropriate.

## Input, output, and web risks
- Validate inputs with allowlists and schema constraints.
- Encode output for its context; avoid unsafe HTML/DOM insertion.
- Use parameterized database queries.
- Protect against CSRF, XSS, SSRF, path traversal, injection, open redirects, request smuggling, and unsafe deserialization as applicable.
- Validate outbound URL schemes, hosts, DNS resolution, redirects, and private/internal address ranges when fetching user-supplied URLs; defend against SSRF and DNS rebinding.
- Limit uploads by type, size, count, and processing time. Store outside executable web roots and scan/process safely.
- Configure CORS narrowly; CORS is not authorization.
- Set security headers and HTTPS appropriately.

## Secrets and sensitive data
- Keep secrets out of source control, logs, browser bundles, prompts, and error responses.
- Use a secret manager or protected environment configuration.
- Redact tokens, credentials, payment data, and unnecessary personal information from logs.
- Minimize collection and retention; define deletion and access controls.
- Use synthetic data in examples and tests.

## Example: authorization is not a UI check
Bad: hide the Admin button and assume non-admins cannot call the endpoint.
Better: verify the caller's permission inside the API handler/service and scope every underlying data query. Test direct API calls as an unauthorized user.

## Security review questions
1. What input is untrusted?
2. What identity and permissions are required?
3. Can a caller access another user's object by changing an ID?
4. Can external content cause code execution, tool use, or data disclosure?
5. Are secrets or sensitive data exposed in logs, errors, analytics, or prompts?
6. What limits stop abuse or expensive resource consumption?
7. What is the recovery plan if a credential or dependency is compromised?

## Baseline HTTP security headers
Set these on every response (tune CSP to the app; start strict and loosen only with reason):
```text
Content-Security-Policy: default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains   (HTTPS/production only)
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```
Remove framework fingerprint headers (e.g. `X-Powered-By`).

## Red-team payload kit (P6)
Try each against every input and ID parameter; every hole found becomes a regression test.
| Attack | Payload / action | Expected |
|---|---|---|
| IDOR/BOLA | Swap resource ID for another user's | 404/403, no data, no change |
| Mass assignment | Add `"ownerId"`, `"role":"admin"`, `"id"` to request JSON | Ignored or 400 |
| XSS | `<img src=x onerror=alert(1)>` in every text field | Rendered as text |
| SQL/NoSQL injection | `' OR '1'='1`, `{"$ne":null}` | Treated as literal / 400 |
| Oversized | 5 MB JSON body, 100k-char string | 413 / 400 |
| Type confusion | Strings where numbers expected, arrays where objects expected, `null` | 400 with field details |
| Auth bypass | Missing/expired/forged session cookie | 401 |
| CSRF | State-changing request from another origin | Rejected |
| Brute force | 50 sign-in attempts/minute | 429 |
| Open redirect | `?next=https://evil.example` | Only same-origin paths accepted |
| Path traversal | `../../etc/passwd` as filename | Rejected / harmless |
| Enumeration | Sign-up/reset with existing vs new email | Indistinguishable responses |
