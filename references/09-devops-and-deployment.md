# 09 — DevOps, CI/CD, and Deployment

## Environments
Keep local, test, staging, and production configuration separate. Use least-privilege credentials per environment. Production data and secrets must not be copied casually into development environments.

## Build and release
- Make builds reproducible where practical.
- Use lockfiles and pinned toolchain/runtime versions according to project policy.
- Run lint, type checks, tests, security/dependency checks, and build in CI as appropriate.
- Build immutable artifacts and promote the same artifact between environments when feasible.
- Use health checks and readiness checks that reflect actual dependencies.
- Prefer gradual/canary/blue-green rollout for high-risk systems when available.
- Define rollback and database compatibility strategy before risky releases.
- Avoid deploying untested changes directly to production.

## Containers
- Use minimal trusted base images and pin versions/digests where practical.
- Run as non-root unless there is a documented need.
- Do not bake secrets into images or build arguments.
- Use `.dockerignore`; keep image contents minimal.
- Add health checks when meaningful and handle termination signals gracefully.

## Infrastructure as code
Review changes for permissions, network exposure, encryption, logging, cost, and destructive replacement. Keep infrastructure state protected. Do not run destructive infrastructure changes without explicit approval.

## Example `.env.example`
```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/app
LLM_API_KEY=replace-with-local-secret
```
Use unmistakable placeholders only. Never include real credentials.

## Deployment checklist
- [ ] Required config and secrets are present and validated.
- [ ] CI checks passed or exceptions are documented.
- [ ] Migrations and rollback compatibility reviewed.
- [ ] Health checks, logs, and alerts are configured.
- [ ] Permissions and network exposure reviewed.
- [ ] Backup/restore and incident ownership are known.
- [ ] Release result is verified rather than assumed.

## Ready-made assets
- `assets/docker/Dockerfile.node` and `assets/docker/Dockerfile.python` — multi-stage, non-root, healthcheck.
- `assets/docker/docker-compose.yml` — app + Postgres for local full stack.
- `assets/ci/github-actions-node.yml` and `assets/ci/github-actions-python.yml` — lint, typecheck, test, build, audit, secret scan.
- `assets/docker/.dockerignore` — keeps secrets and build junk out of images.
Copy and adapt; never leave placeholder values that would break the build.

## Graceful shutdown
On SIGTERM: stop accepting new connections, finish in-flight requests with a deadline (e.g. 10 s), close DB pools and queues, then exit 0. Readiness should fail as soon as shutdown begins so load balancers stop routing.

## Deploy hand-off (hard stop)
Prepare everything so deployment is one human action: documented env vars, a migration command, a health URL to check, and a rollback step. Do not run the deploy yourself.
