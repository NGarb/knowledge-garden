# Knowledge Garden — Agent Learning Roadmap

## North star

A garden that thinks with you. You capture what you learn; the garden connects it, challenges it, and extends it — surfacing contradictions, finding patterns across domains, sending research agents out on your behalf, and synthesizing arguments from your evidence base. By the end, the garden is not just a storage system. It is a reasoning partner that runs while you sleep.

**Current phase:** Phase 1 — Foundation

---

## Phases

### Phase 0 — What we have ✓

**Built:** Streaming classification, pgvector similarity search, contradiction detection, question lifecycle, SSE streaming, Vercel serverless routes.

**What it is:** A semantic capture engine with RAG retrieval. Missing the generation layer — you can't ask the garden a question and get an answer back.

**Key insight:** *(fill in your own words after reflecting)*

---

### Phase 1 — Ask your garden

**Status:** `not started`

**Learn:**
- Anthropic SDK basics — `messages.create`, streaming, stop reasons
- RAG generation — embed query → pgvector retrieval → synthesize answer with sources
- Prompt caching — cache-stable system prompts, `cache_control` on large context blocks
- Token counting — `client.messages.countTokens()` before sending, never use tiktoken

**Build:**
- Switch classification from OpenAI to Claude (`claude-haiku-4-5` for cost, `claude-opus-4-8` for quality)
- `/api/ask` route — embed question → retrieve top-k entries → Claude generates grounded answer with citations
- Answer view with source links back to garden entries
- Show "I don't know yet" gracefully when retrieval comes up empty

**Production concern introduced:** Prompt caching. Your system prompt and retrieved entries are large, stable prefixes. Cache them or pay full price on every question. Rule: nothing dynamic (timestamps, user IDs) goes in the system prompt.

**Key insight:** *(fill in after completing)*

---

### Phase 2 — Research agent

**Status:** `not started`

**Learn:**
- Tool definitions — JSON schema, input validation, return format
- Agentic loop — `stop_reason: "tool_use"` → execute tools → return results → loop until `end_turn`
- Server-side tools — `web_search_20260209`, `web_fetch_20260209` (no infrastructure needed)
- Parallel tool calls — Claude can call multiple tools at once; return all results in one user message
- Error handling in tools — always return something; use `is_error: true` for failures

**Build:**
- Research agent with web search + web fetch
- Auto-capture: agent findings become draft entries for approval
- Approval gate UI — you review before anything hits the database
- Step label streaming — show the user what the agent is doing in real time (you already have this pattern in Capture)

**Production concern introduced:** The harness is the gatekeeper. The model proposes tool calls; your harness decides whether to execute them. Never auto-execute writes to your database without a human approval gate. Destructive actions (deletes, overwrites) always require explicit confirmation.

**Key insight:** *(fill in after completing)*

---

### Phase 3 — Deep analysis

**Status:** `not started`

**Learn:**
- Context management — the context window is working memory; what you put in it determines what the model can reason about
- Compaction — add `compact-2026-01-12` beta to summarize long sessions; the model loses no thread
- Context editing — clear stale tool results mid-session to recover window space
- Multi-turn conversations — maintaining coherent state across many turns without context bloat

**Build:**
- Digest v2 — multi-turn analysis session that reasons across your entire garden, not just a single summary
- Cross-garden synthesis — find patterns and tensions between your ai + world gardens
- Thesis generator — given a position, draft an argument from your evidence base with counterarguments

**Production concern introduced:** Context poisoning. Long-running agents accumulate stale tool results, failed attempts, and redundant data that degrades reasoning quality. Budget your context window: count tokens before sending, compact aggressively, clear tool results that are no longer relevant.

**Key insight:** *(fill in after completing)*

---

### Phase 5 — Intelligent gardening

**Status:** `not started`

**Ideas:**

- **Gap detection / next nudge** — analyze the knowledge graph for structural holes: concepts referenced but not explained, topics with shallow coverage, prerequisite concepts missing for things already known. Surface one or two "what you should learn next" suggestions after each capture session. Implementable as a meta-query over existing RAG infrastructure.

- **Newsletter processing** — periodic ingestion of AI newsletters (via Gmail API or email forwarding). Extract useful concepts, fetch full content if paywalled or truncated, add as draft entries for approval before hitting the database.

- **Source quality / fact-grounding** — when notes are added or queried, flag claims that lack citations, suggest better primary sources, and distinguish opinion from fact. Keep the garden extremely fact-based even when it contains personal thoughts.

---

### Phase 4 — Living garden

**Status:** `not started`

**Learn:**
- Managed Agents — Anthropic runs the loop and hosts the execution environment; per-session containers, file mounts, MCP
- When NOT to use Managed Agents — if you host compute, need multi-provider, or want fine-grained loop control, use raw SDK
- Multi-agent orchestration — orchestrator routes tasks to specialist agents; each agent has a narrow, well-defined surface
- Observability at scale — cost per session, error rates by tool, latency percentiles, context usage trends

**Build:**
- Scheduled research agents — monitor your topics daily, surface new findings as draft entries
- Devil's advocate agent — given your settled facts, find the strongest counterarguments
- Dynamic gardens — user-created gardens beyond the hardcoded `ai` and `world`
- Per-session cost tracking — show cost of each analysis in the UI

**Production concern introduced:** Agent versioning and rollback. In production, agents are stored objects with versions. Pin sessions to a specific agent version so a prompt change doesn't silently change behavior for all active users. Test new versions in shadow mode before promoting.

**Key insight:** *(fill in after completing)*

---

## Choosing your runtime

Ask these questions in order. Stop at the first match.

**1. Do you need Anthropic to host and run the execution environment?**
Yes → **Managed Agents.** Per-session containers, file ops, bash, MCP servers, memory stores — all hosted. You provide prompts and tools; Anthropic runs the loop.
No → continue.

**2. Do you need multi-provider flexibility (OpenAI, Gemini, etc.)?**
Yes → **Raw HTTP or provider-agnostic SDK** (Vercel AI SDK for JS). You write the loop.
No → continue.

**3. Do you need fine-grained loop control — approval gates, custom logging, conditional execution, per-tool rate limiting?**
Yes → **Anthropic SDK, manual loop.** Full control over every turn.
No → continue.

**4. Is your task multi-step but the logic is code-controlled (not model-driven)?**
Yes → **Anthropic SDK + tool runner.** Handles the loop automatically.
No → it's probably a single API call. Don't over-engineer it.

**When to choose Managed Agents specifically:**
- You want isolated compute per session (each user gets their own container)
- You need file mounts or persistent workspaces
- You want versioned, stored agent configs
- You're building a coding agent, research agent, or anything that needs bash/file ops

**When to stay with raw SDK:**
- You need the loop to pause for human approval
- You need custom logging on every tool call
- You're building on multiple providers
- You want to understand what's happening (Managed Agents abstract the loop away)

---

## Production engineering reference

### Cost

- **Prompt caching** — the single highest-leverage cost optimization. Saves up to 90% on repeated large prompts. Requires cache-stable prefixes: no timestamps, no UUIDs, no dynamic content in `system` or `tools`.
- **Model tiering** — use `claude-haiku-4-5` for cheap classification, extraction, routing decisions. Use `claude-opus-4-8` for reasoning, synthesis, judgment calls. Never use a flagship model for a task a smaller model can do.
- **Token budgeting** — count tokens before sending long contexts. Set hard limits per session. Surface cost to users for expensive operations.
- **Batch API** — for non-real-time work (overnight digests, bulk re-classification), use the Batch API. 50% discount, async, no streaming needed.

### Reliability

- **Retry strategy** — exponential backoff on 429 (rate limit) and 529 (overloaded). The SDK retries twice by default. For production, implement your own with jitter.
- **Tool error handling** — always return a result from a tool, even on failure. Use `is_error: true` with a clear message. The model can reason about failures and try alternatives; a thrown exception kills the loop.
- **Graceful degradation** — if the agent can't complete a task, return a partial result with an explanation. Never silently return nothing.
- **Idempotency** — tool calls may be retried. Design tools to be safe to call twice (check-before-write, upsert over insert).

### Observability

Log these on every agent turn:
- Input tokens, output tokens, cache read tokens, cache write tokens
- Wall-clock latency per turn
- Which tools were called and with what arguments
- Tool execution time
- `stop_reason` (catch unexpected `max_tokens`, `refusal` early)
- Total session cost (compute from token counts × per-token price)

Alert on:
- Cost per session exceeding threshold
- `stop_reason: "max_tokens"` (context window problem)
- Tool error rate > 5%
- P95 latency regression

### Security

- **Validate tool inputs** — the model's tool arguments are untrusted. Validate path traversal in file tools, SQL injection in query tools, command injection in shell tools. Never pass model output directly to `exec()`, `eval()`, or a shell.
- **Approval gates for writes** — reads are generally safe to auto-execute. Writes, deletes, and external API calls should require human confirmation or at minimum explicit opt-in.
- **Scope tool permissions** — a tool that reads files shouldn't be able to write them. Narrow the surface of each tool to exactly what it needs.
- **Prompt injection** — content fetched from the web or user documents can contain instructions. Treat retrieved content as data, not instructions. Isolate it from your system prompt.
- **Audit log** — keep a record of every tool call an agent made in a session, with arguments and results. You need this for debugging and for explaining agent behavior to users.

### Context engineering

- **Cache-stable system prompts** — write system prompts that never change between requests. Dynamic content (user name, current date, session state) goes in the first user message, not the system prompt.
- **Structured tool returns** — tools should return structured data (JSON), not prose. Prose in tool results consumes context and is harder to reason over. Return the minimum the model needs, not a full API response.
- **Compact aggressively** — don't wait until you're near the limit. Compact long sessions proactively. The model retains the thread; you recover the window.
- **Context poisoning** — failed tool calls, retried attempts, and stale results accumulate and degrade reasoning. Clear them with context editing when they're no longer relevant.
- **Front-load context** — the most important information goes earliest in the prompt. Models attend better to early context in very long windows.

### Harness design principles

1. **The harness is the gatekeeper, not the model.** The model proposes; the harness decides. Approval gates, rate limits, input validation — all live in the harness, not in the system prompt.

2. **Tools return data, not decisions.** A tool that returns "you should do X next" is doing the model's job. Return structured facts; let the model decide what to do with them.

3. **Name tools for what they do, not what the model thinks they do.** `search_entries` not `find_related_knowledge`. The model infers intent from names; be precise.

4. **Make the harness observable.** Every tool call goes through a logging layer. You should be able to replay any agent session from logs alone.

5. **Design for human-in-the-loop from the start.** Adding approval gates later is painful. Build the approval flow in Phase 2 and every subsequent phase benefits.

6. **The system prompt is a contract.** It tells the model what it is, what tools it has, and what it should and shouldn't do. Treat it like code — version it, test it, review changes carefully.

---

## Lessons learned

*(Add entries here as you go — surprises, things that didn't match the theory, decisions made and why)*

---

*Started: June 2026*
