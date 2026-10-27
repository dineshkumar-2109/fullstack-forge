# Tasklane API

Base path `/api`. JSON only (`Content-Type: application/json`). Authentication is the `sid`
session cookie set by sign-up / sign-in. State-changing requests from another origin are rejected.

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/auth/signup` | – | `{ email, password (10–128) }` | 201 `{ user }` + cookie |
| POST | `/auth/signin` | – | `{ email, password }` | 200 `{ user }` + cookie |
| POST | `/auth/signout` | – | – | 204, cookie cleared |
| GET | `/session` | – | – | 200 `{ user }` or `{ user: null }` (UI session probe) |
| GET | `/me` | ✓ | – | 200 `{ user }` |
| GET | `/me/export` | ✓ | – | 200 full JSON export (attachment) |
| DELETE | `/me` | ✓ | `{ password }` | 204, everything deleted |
| GET | `/projects?limit=1..100&cursor=` | ✓ | – | 200 `{ items: Project[], nextCursor }` |
| POST | `/projects` | ✓ | `{ name (1–80) }` | 201 `{ project }` |
| GET | `/projects/:id` | ✓ | – | 200 `{ project }` |
| PATCH | `/projects/:id` | ✓ | `{ name }` | 200 `{ project }` |
| DELETE | `/projects/:id` | ✓ | – | 204 (cascades to tasks) |
| GET | `/projects/:id/tasks?status=todo|doing|done&limit=1..200&cursor=` | ✓ | – | 200 `{ items: Task[], nextCursor }` |
| POST | `/projects/:id/tasks` | ✓ | `{ title (1–200), status?, dueOn? (YYYY-MM-DD or null) }` | 201 `{ task }` |
| PATCH | `/tasks/:id` | ✓ | `{ version, title?, status?, dueOn? }` | 200 `{ task }` |
| DELETE | `/tasks/:id` | ✓ | – | 204 |

Types:
- `Project`: `{ id, name, taskCount, openTaskCount, createdAt, updatedAt }`
- `Task`: `{ id, projectId, title, status, dueOn, version, createdAt, updatedAt }`

Errors (`{ error: { code, message, details?, requestId } }`):

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Field problems; `details[]` lists `{ field, reason }` (unknown fields → `unknown_field`) |
| 400 | `BAD_REQUEST` | Malformed JSON, bad cursor/limit/status filter |
| 401 | `UNAUTHENTICATED` / `INVALID_CREDENTIALS` | No/expired session; wrong email or password |
| 403 | `FORBIDDEN` | Cross-origin state change |
| 404 | `NOT_FOUND` | Missing **or belongs to another user** |
| 405 | `METHOD_NOT_ALLOWED` | `Allow` header lists valid methods |
| 409 | `CONFLICT` | Duplicate email/project name; stale task `version` |
| 413 | `PAYLOAD_TOO_LARGE` | Body over `MAX_BODY_BYTES` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Body is not JSON |
| 429 | `RATE_LIMITED` | `Retry-After` header in seconds |
| 500 | `INTERNAL_ERROR` | Logged server-side with the `requestId` |

Operational endpoints: `GET /healthz` (process alive), `GET /readyz` (DB reachable; 503 while shutting down).
