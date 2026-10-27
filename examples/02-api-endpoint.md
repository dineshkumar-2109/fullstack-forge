# Example — Safe API Endpoint Pattern

Framework-neutral pseudocode:
```ts
async function createProject(request: Request): Promise<Response> {
  const actor = await authenticate(request);
  if (!actor) return errorResponse(401, "UNAUTHENTICATED");

  const body = await readJsonWithLimit(request, MAX_BODY_BYTES);
  const input = CreateProjectSchema.parse(body);

  await authorize(actor, "project:create");

  const project = await projectService.create({
    ownerId: actor.id, // trusted identity, not caller-provided
    name: input.name.trim()
  });

  return jsonResponse(201, toProjectDto(project));
}
```

Notes:
- Real API syntax depends on the framework.
- Use a consistent error mapper for validation exceptions.
- Ensure `trim()` is appropriate for the domain.
- Add rate limiting and audit logging if the endpoint's risk warrants it.
- Never expose internal persistence objects blindly.
