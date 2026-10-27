# Full-Stack Engineering Skill — Autonomous Product Builder

An agent skill that turns a one-line idea (or an existing repo) into a **production-ready,
tested, documented, deployable product — without a human between steps** — and proves it.

Most coding skills stop at "write good code". This one runs a complete product team's process:

| | What it adds |
|---|---|
| **A gated pipeline** | P0 intake → P1 PRD → P2 architecture + threat model → P3 walking skeleton → P4 vertical slices → P5 self-verification in a real browser → P6 red-team hardening → P7 packaging → P8 honest delivery report |
| **Real autonomy rules** | Decide-or-ask rule, default answers, decision/assumption logs, budgets and loop detection, a stuck protocol, and context-loss recovery via `.autobuild/` state files |
| **Safety rails** | Hard stops for money, real credentials, production, real messaging, destructive ops and legal claims — with adapters + fakes so the product still runs end to end |
| **Evidence, not claims** | Scripts that run the real gates and exit non-zero on failure; an evidence ladder; a delivery report format where every PASS was observed |
| **Proof it works** | A working reference app built with this process: 48 tests, browser smoke test, e2e story walkthrough, readiness score 100/100 — plus its full `.autobuild/` trail and screenshots |

## Contents

```
SKILL.md                     the orchestrator: laws, hard stops, pipeline P0–P8, routing
references/                  23 focused guides, loaded only when a phase needs them
  00-autonomous-operating-mode.md   decide-or-ask, defaults, state, budgets, self-review hats
  01–15                              engineering standards (frontend, API, DB, security, testing, AI, ops…)
  16-product-discovery-and-spec.md  idea → PRD, implied features by product type, NFR defaults
  17-greenfield-stack-selection.md  golden-path stacks, decision matrix, project layouts
  18-product-modules.md              auth, multitenancy, billing, email, uploads, jobs, search, audit, admin…
  19-ui-ux-quality.md                tokens, states, copy, responsive, a11y, visual review checklist
  20-self-verification-loop.md       evidence ladder, browser smoke, e2e, API probing, honest reporting
  21-privacy-compliance-and-legal.md data inventory, export/delete, regulated domains, licenses
  22-failure-recovery-playbook.md    known failures and fixes, environment substitutes, scope cutting
scripts/                     executable gates (Python stdlib + Playwright)
  init_state.py  detect_stack.py  quality_gate.py  secret_scan.py  readiness_audit.py  smoke_test.mjs
templates/                   prd, architecture, adr, threat-model, runbook, delivery-report, feature-plan, bug-report, pr-review, ai-feature-review
assets/                      production Dockerfiles (Node, Python), compose, .dockerignore, GitHub Actions (Node, Python)
examples/
  01–05                      focused patterns (feature trace, safe endpoint, RAG, agent tool, test matrix)
  06-autonomous-build-walkthrough.md   one sentence → shipped product, phase by phase
  07–10                      decision logs, stuck protocol, red-team findings, honest delivery report
  reference-app/             Tasklane — the product built by the walkthrough (runnable)
evals/evals.json             test prompts with expectations for measuring the skill
```

## Install

- **Claude Code / Claude apps / Agent SDK:** put the `fullstack-engineering-skill` folder in your skills directory (e.g. `~/.claude/skills/` or the project's `.claude/skills/`), or upload the zip as a skill. `SKILL.md` is the entry point; its description triggers it for build/ship/production requests.
- **Other assistants:** point them at `SKILL.md` as the primary instruction file and keep the folder structure so relative paths resolve.

Requirements for the scripts: Python ≥ 3.9 (stdlib only). The smoke test needs Node and the
`playwright` package with Chromium (`npm i -D playwright && npx playwright install chromium`).

## Try it

```text
Build me a production-ready app for [your idea]. Work autonomously and give me the delivery report at the end.
```

Or on an existing repo:

```text
Is this repo production ready? Run the readiness audit, fix the critical gaps, and prove it.
```

Run the gates yourself on any project:

```bash
python3 scripts/detect_stack.py path/to/project
python3 scripts/quality_gate.py path/to/project
python3 scripts/secret_scan.py path/to/project
python3 scripts/readiness_audit.py path/to/project
node scripts/smoke_test.mjs --base-url http://localhost:3000 --paths / /login
```

Explore the reference app:

```bash
cd examples/reference-app
npm ci && npm run db:seed && npm start      # http://localhost:3000  demo@tasklane.test / demo-password-123
npm test                                     # 48 tests
BASE_URL=http://localhost:3000 npm run test:e2e
```

## What "without human intervention" means here — honestly

The skill makes every engineering and product decision itself and keeps going. It deliberately
**does not** spend money, create cloud resources, use credentials it was not given, deploy to
production, message real people, or present legal text as final. Those are prepared up to the
last step and handed to you as an exact checklist in the delivery report. That boundary is what
makes it safe to leave running.

## Customizing
- Put company stack preferences in `references/17-greenfield-stack-selection.md` (golden paths).
- Add your own product modules to `references/18`.
- Tighten or relax gates: `readiness_audit.py --min-score`, budgets in `references/00 §5`.
- Keep project-specific instructions in the repo's own `AGENTS.md` / `CLAUDE.md`; the skill reads them first and they win.
