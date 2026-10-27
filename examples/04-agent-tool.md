# Example — Safe Agent Tool

Tool schema (illustrative TypeScript/Zod):
```ts
const CreateSupportTicketInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(5000),
  priority: z.enum(["low", "normal", "high"])
});
```

Execution boundary:
```ts
async function createSupportTicketTool(rawArgs: unknown, context: TrustedContext) {
  const input = CreateSupportTicketInput.parse(rawArgs);
  const actor = await requireActor(context);
  await authorization.require(actor, "support-ticket:create");

  return supportTicketService.create({
    requesterId: actor.id,
    ...input
  });
}
```

The `TrustedContext` must be built by trusted server code. The model cannot supply its own actor identity or permission claims. If the tool sends a message externally or performs a destructive action, require explicit confirmation according to product policy.
