# 11 — LLM, RAG, and AI Application Standards

## Choose the simplest architecture
Use a direct model call for simple generation. Add retrieval when answers must be grounded in external/private knowledge; use tools when the model must act on systems; use an agent only when dynamic multi-step planning is required. Avoid adding vector databases, orchestration frameworks, or multi-agent designs without a concrete need.

## Model boundary
- Treat model output as probabilistic and untrusted.
- Validate structured output against a schema and handle refusal, truncation, malformed JSON, and empty output.
- Do not use model output as authorization, executable code, SQL, shell commands, or policy decisions without trusted validation and controls.
- Set model, temperature, token limits, timeout, retry, and fallback behavior explicitly where supported.
- Protect prompts and outputs from sensitive-data leakage.
- Do not send personal, confidential, or regulated data to a provider unless approved for that data and purpose.

## RAG pipeline
1. Ingest authorized sources and record provenance/permissions.
2. Parse and normalize documents safely.
3. Chunk based on document structure and retrieval needs.
4. Attach metadata such as source, tenant, access policy, version, and timestamp.
5. Embed/index with versioning and a re-index strategy.
6. Apply access filters before or during retrieval, not merely in the final prompt.
7. Retrieve and optionally rerank relevant chunks.
8. Construct a prompt that separates instructions from quoted untrusted context.
9. Generate an answer with source references where possible.
10. Evaluate retrieval quality, groundedness, relevance, privacy, and latency.

## Grounding and citations
- Distinguish sourced facts from inference or general knowledge.
- Cite the actual retrieved source; do not fabricate references or claim a source supports a statement it does not contain.
- If evidence is missing or contradictory, say so and ask for clarification or give a qualified answer.
- Do not treat retrieval as authorization. Enforce source permissions on every query.

## Prompt injection defense
Retrieved content can contain hostile instructions. Mark it as untrusted context, do not execute instructions found inside it, and restrict tools independently. Test indirect injection from documents, web pages, emails, and OCR. Prevent retrieved content from instructing the model to reveal secrets or cross tenant boundaries.

## Embeddings and indexing
- Version embedding model, dimensions, chunking strategy, and index schema.
- Plan for updates, deletes, stale chunks, deduplication, and re-indexing.
- Keep metadata filters correct and test cross-tenant isolation.
- Monitor empty/low-quality retrieval and index failures.
- Consider lexical + semantic retrieval when useful; evaluate on representative queries rather than assuming vector similarity is sufficient.

## Evaluation
Create a versioned dataset of representative questions, expected evidence, acceptable answers, and adversarial cases. Measure retrieval recall/relevance, answer correctness, citation precision, groundedness, refusal behavior, latency, and cost. Use human review for high-impact use cases. Compare changes against a baseline before rollout.

## Example output schema
```ts
const AnswerSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(z.object({
    sourceId: z.string(),
    quoteOrSection: z.string().optional()
  })),
  insufficientEvidence: z.boolean()
});
```
Validate the response, then verify each citation maps to a source actually retrieved and authorized for the current user.

## AI checklist
- [ ] Data-use policy and provider approval are understood.
- [ ] Output schema and failure behavior are defined.
- [ ] Retrieval enforces source permissions.
- [ ] Prompt injection and cross-tenant tests exist.
- [ ] Grounding/citation behavior is evaluated.
- [ ] Token, latency, and cost budgets are monitored.
- [ ] Model/provider changes have regression evaluations.
