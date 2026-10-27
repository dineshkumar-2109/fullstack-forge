# 10 — AI Agents and Tool Calling

## Architecture
Prefer deterministic workflows and ordinary application code when they meet the need. Use an agent only when dynamic planning or tool selection materially helps. Separate orchestration, tool adapters, policy/authorization, state, validation, and response rendering.

## Tool design
- Use an explicit allowlist of tools.
- Give each tool one narrow purpose and a strict typed input/output schema.
- Validate tool arguments in code; never treat model-generated JSON as inherently valid.
- Enforce authorization outside the model, at the tool or service boundary.
- Apply least privilege and pass only the data needed for the task.
- Avoid arbitrary shell, SQL, filesystem, or unrestricted HTTP tools. If unavoidable, sandbox and restrict them.
- Treat tool output as untrusted data and validate it before using it in another action.

## Prompt injection and trust boundaries
User text, web pages, retrieved documents, uploaded files, emails, tool outputs, and previous model outputs are data—not trusted instructions. Do not allow these sources to override system policy, expand tool permissions, or cause secret disclosure. Keep instruction hierarchy explicit. Validate URLs and defend outbound fetches against SSRF. Do not expose hidden prompts, credentials, or unrelated tenant data.

## Limits and reliability
Set explicit limits for agent steps, wall-clock time, tool calls, parallelism, tokens, and spend. Use timeouts, bounded retries, stop conditions, and loop detection. Handle malformed arguments, empty results, tool outages, rate limits, partial failures, and cancellation. Never loop indefinitely or keep retrying a permanent failure.

## Consequential actions and approval
Require explicit user confirmation before consequential or irreversible actions—such as deleting records, sending messages, changing access, purchasing, or publishing—unless a clearly authorized policy says otherwise. Show the action and material parameters. After approval, revalidate permissions and current state. Ambiguity is not consent. Record an audit event.

## Memory and state
Persist only necessary state. Scope it by user, tenant, and session. Validate memory before acting; past model outputs are not authoritative facts. Define retention, user access, correction, and deletion behavior. Prevent cross-user leakage.

## Observability
Record run ID, tool name, safe/redacted arguments, status, duration, retries, and outcome. Track failure rate, denials, loops, latency, token usage, and cost. Never log secrets or full sensitive payloads by default.

## Testing
Test normal use, invalid/oversized arguments, unauthorized access, cross-tenant attempts, prompt injection, malformed tool output, timeouts, rate limits, duplicate retries, approval bypass, loop/budget exhaustion, and partial failure. Evaluate task completion, tool selection, argument correctness, authorization, recovery, latency, and cost.

## Example tool boundary
```ts
const input = CreateTicketSchema.parse(modelArguments);
const actor = await requireAuthenticatedUser(request);
await authorize(actor, "ticket:create");
return ticketService.create({ actorId: actor.id, title: input.title });
```
The model does not choose `actorId` or grant itself permission. Derive identity from the authenticated request and enforce authorization in trusted code.

## Final agent report
Summarize architecture, tools and permissions, trust boundaries, limits, approval points, tests run/results, and known risks. Never claim an action succeeded until the underlying system confirms it.
