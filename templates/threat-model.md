# Threat model — [Product name]

## Assets
[Accounts, user content, payment state, API keys, admin capabilities…]

## Actors
- Anonymous visitor · Authenticated user · Other tenant's user · Admin · Compromised dependency/provider · Automated bot

## Trust boundaries
[Browser ↔ API · API ↔ DB · API ↔ third parties · user-supplied URLs/files · LLM inputs/outputs]

## Abuse cases and controls
| # | Abuse case | Impact | Control | Test |
|---|---|---|---|---|
| T1 | User swaps an ID to read another user's data (IDOR) | Data breach | Owner-scoped queries; 404 | IDOR matrix test |
| T2 | Credential stuffing / brute force | Account takeover | Rate limit, uniform errors, slow KDF | 429 test |
| T3 | Stored XSS via user text | Session theft | Output encoding, CSP | XSS payload test |
| T4 | CSRF on cookie-authenticated writes | Unwanted actions | SameSite + origin check | Cross-origin test |
| T5 | Mass assignment (`role`, `ownerId`) | Privilege escalation | Reject unknown fields | Unknown-field test |
| T6 | Oversized/abusive payloads | DoS | Body limits, pagination caps, timeouts | 413/400 tests |
| T7 | Secrets leaked in logs/repo | Compromise | Redaction, secret scan | Log + scan checks |
| T8 | [Product-specific: payments, uploads, SSRF, prompt injection…] | | | |

## Residual risks
[What remains and why it is acceptable for now; link to BACKLOG.]
