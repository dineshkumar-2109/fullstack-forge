# Example — Delivery Report: honest vs. dishonest

The delivery report is what the human reads first. It must be short, scannable, and true.

## Good (excerpt from reference-app/.autobuild/DELIVERY.md)

```md
## Verification (evidence level reached: 8 of 9)
| `npm test`                     | PASS — 48 tests, 0 failed |
| `scripts/smoke_test.mjs`       | PASS — 16/16 page-views clean; screenshots in `screenshots/` |
| `npm run test:e2e`             | PASS — 7/7 steps, 0 browser errors |
| `docker build`                 | NOT RUN — no Docker daemon in the build environment; CI builds it |

## Found and fixed during self-verification
- Logged-out pages produced a 401 console error → added `/api/session` + test.

## Human actions needed (hard stops)
- Choose an email provider to enable password reset (H-001).
```

Why it is good: every PASS maps to a command that was run; skipped checks say why; bugs found
during verification are disclosed (this increases trust); the human's to-do list is explicit.

## Bad

```md
✅ All tests pass
✅ Fully production ready and deployed
✅ Secure (OWASP compliant)
✅ Docker image builds successfully
Password reset implemented.
```

What is wrong:
- "All tests pass" — which command, how many tests? Unverifiable.
- "Deployed" — deploying is a hard stop; claiming it without doing it is fabrication.
- "OWASP compliant" — a compliance claim no build can make; list the controls instead.
- "Docker image builds" — the environment had no Docker daemon; this was never observed.
- "Password reset implemented" — only a UI button existed, with no email provider. A dead feature presented as done.

**Rule:** if you didn't see it pass, it is NOT RUN. A shorter, true report beats a long, impressive one.
