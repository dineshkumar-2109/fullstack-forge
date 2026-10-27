# 17 — Greenfield Stack Selection and Project Layout

In repository mode, **ignore this file's defaults** and use the existing stack.
In greenfield mode, pick a golden path below unless the user named a stack.

## Contents
1. Selection rules
2. Golden paths
3. Decision matrix
4. Project layouts
5. Version pinning and toolchain
6. Anti-patterns

---

## 1. Selection rules

1. User-specified stack wins, always.
2. Otherwise choose the path with the **largest ecosystem and best tooling the environment can actually run** (check runtimes in P0).
3. One language end to end unless there is a reason (ML-heavy backend → Python API is a valid reason).
4. Managed services over self-hosted infrastructure for production docs; local equivalents via Docker Compose.
5. Every choice gets an ADR line in DECISIONS.md.

## 2. Golden paths

**A. TypeScript full-stack web app (default for most SaaS/web products)**
- Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS
- Validation: Zod, shared between client and server
- DB: PostgreSQL + Prisma or Drizzle (migrations committed); SQLite for tests if the ORM supports it cleanly, otherwise Testcontainers/PGlite
- Auth: a maintained library (Auth.js / Lucia-style session pattern / Better Auth) — never hand-rolled crypto
- Tests: Vitest (unit/integration) + Playwright (e2e)
- Lint/format: ESLint + Prettier (or Biome)
- Jobs: a DB-backed queue (pg-boss / Graphile Worker) before reaching for Redis
- Deploy docs: Docker image + one PaaS (Fly.io / Render / Railway / Vercel + managed Postgres)

**B. Separate SPA + API (when a mobile app or third parties will consume the API)**
- Frontend: Vite + React + TypeScript + TanStack Query + React Router + Tailwind
- API: Node (Fastify/Express/Hono) + Zod + OpenAPI generation, or Python FastAPI + Pydantic
- Same DB/test/deploy choices as A; CORS configured narrowly; cookie auth on same site or token auth with short-lived access tokens

**C. Python product (data/ML/AI-heavy)**
- FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic + PostgreSQL
- Frontend: path B frontend, or server-rendered Jinja + HTMX for internal tools
- Tests: pytest (+ httpx test client), Playwright for e2e; lint: Ruff; types: mypy or pyright
- Packaging: uv or Poetry with lockfile; Docker multi-stage
- Jobs: Celery/RQ/Arq, or Postgres-based queue for low volume

**D. Content site / landing page / docs**
- Astro (or Next.js static export) + Tailwind; Markdown/MDX content; forms posted to a small serverless/API handler with validation and spam protection
- Static hosting (any CDN); Lighthouse budget in CI

**E. Internal CRUD tool, fastest path**
- Django + Django admin + PostgreSQL (or Rails) — batteries included auth, admin, migrations
- Use only when the product is primarily data entry/admin and the user did not pick another stack

**F. Zero-dependency / constrained environment**
- Node ≥ 22 standard library (`node:http`, `node:test`, `node:sqlite` where available) or Python standard library — used by `examples/reference-app/` precisely so it runs anywhere
- Good for demos, offline environments, and as a pattern reference; for a real product prefer A–E

## 3. Decision matrix

| Signal in the request | Path |
|---|---|
| "SaaS", "web app", "dashboard", no stack named | A |
| "mobile app later", "public API", "Flutter/React Native client" | B |
| "ML model", "data pipeline", "Python", "notebook" | C |
| "landing page", "portfolio", "blog", "docs site" | D |
| "admin panel", "back office", "internal tool" with heavy CRUD | E (or A) |
| No network for package installs | F, and record the constraint |
| "chatbot", "RAG", "AI assistant" | A or C + refs 10/11; pick C if heavy retrieval/ML, A if mostly UI |

## 4. Project layouts

**Path A**
```
app/                 # routes (pages + route handlers)
  (marketing)/       # public pages
  (app)/             # authenticated app pages
  api/               # route handlers — thin: parse → authz → service → map
components/ui/       # design-system primitives
components/<feature>/
lib/
  config.ts          # env parsing + validation (fails fast)
  db.ts              # db client singleton
  auth.ts
  errors.ts          # AppError + mapping to HTTP envelope
  logger.ts
server/
  <feature>/
    <feature>.schema.ts      # zod input/output schemas
    <feature>.repository.ts  # all queries, owner-scoped
    <feature>.service.ts     # business rules
prisma/ or drizzle/  # schema + migrations
tests/ (unit, integration) e2e/ (playwright)
.github/workflows/ci.yml  Dockerfile  docker-compose.yml  .env.example  README.md
```

**Path C**
```
app/
  main.py  config.py  db.py  errors.py  logging.py  security.py
  <feature>/ router.py  schemas.py  service.py  repository.py  models.py
migrations/ (alembic)
tests/ unit/ integration/ e2e/
pyproject.toml  uv.lock  Dockerfile  docker-compose.yml  .env.example  README.md
```

The principle in every layout: **routes are thin, services hold rules, repositories hold
queries, and every repository function takes the actor/owner explicitly.**

## 5. Version pinning and toolchain

- Pin the runtime (`.nvmrc`/`engines`, `.python-version`, `.tool-versions`).
- Commit the lockfile. Use exact or caret versions per ecosystem norm, but always a lockfile.
- Use the current stable major of each framework that your environment can install; check with the package manager rather than memory (`npm view <pkg> version`, `pip index versions <pkg>`).
- Scripts in the manifest are the contract: `dev`, `build`, `start`, `test`, `lint`, `typecheck`, `format`, `db:migrate`, `db:seed`. The quality gate and README rely on them.

## 6. Anti-patterns

- Microservices, Kubernetes, event sourcing, or GraphQL federation for an MVP.
- Two ORMs, two state managers, two CSS systems.
- A vector database when Postgres + pgvector (or no retrieval at all) is enough.
- Rolling your own auth crypto, session tokens, or password hashing.
- Choosing a framework version you cannot install in the current environment.
