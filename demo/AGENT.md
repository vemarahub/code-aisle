# Code Aisle — the agent layer (feature/code-aware-agent)

This branch turns the retriever-that-answers into a genuine **agent**: an LLM
that **decides, acts, observes, and remembers** in a loop — with MongoDB as both
its retrieval tool *and* its memory.

> Honest scope: MongoDB is the agent's **knowledge + memory backbone**, not its
> brain. The reasoning is an LLM (Ollama). MongoDB provides retrieval and state.

## Retriever vs. agent (what actually changes)

| | Today (main) | Agent (this branch) |
| --- | --- | --- |
| Flow | fixed: retrieve → answer | LLM decides: retrieve (maybe refine) → observe → repeat → answer |
| Memory | none | conversation + semantic long-term memory in MongoDB |
| Turns | one-shot | multi-turn chat, recalls earlier context |

## The loop (decide → act → observe)

```
message + memory
      │
      ▼
  ┌── LLM decides ──┐        (structured JSON: {action, query|answer})
  │                 │
  ▼                 ▼
retrieve(query)   answer
  │  (MongoDB tool)  │
  ▼                  │
observe results ─────┘  → loop again (bounded) or finish
```

- The LLM emits a **structured decision** each step: either
  `{ "action": "retrieve", "query": "…refined…" }` or
  `{ "action": "answer", "answer": "…" }`.
- `retrieve` runs the **existing** `retrieveCode()` (MongoDB `$vectorSearch` →
  `$rerank`). Results are fed back; the LLM observes and decides again.
- **Bounded** to `MAX_STEPS` (default 3) so it can't loop forever — if it hits
  the cap, it answers with whatever it has.

## Tools

- **`retrieve(query)`** — the one real tool: semantic code search in MongoDB.
  Kept to a single tool for clarity; the *loop* value shows through **query
  refinement** (retrieve → "insufficient" → refine → retrieve again).
- Extensible: more tools (open file, run tests) would slot into the same
  decision switch later.

## Memory (MongoDB — the point of the exercise)

Collection **`agent_memory`**, one document per turn:
```
{ sessionId, role: "user" | "assistant", content, createdAt }
```

- **Short-term (conversational):** load the last N turns for `sessionId` to give
  the LLM the running thread.
- **Long-term (semantic):** an `autoEmbed` index over `content` lets the agent
  **vector-search its own past turns** — recalling relevant earlier discussion
  even from outside the recent window. Same Automated Embedding pattern as the
  code corpus (MongoDB owns the vectors; no embedding pipeline).

## Components (all additive — nothing on main changes)

| File | Role |
| --- | --- |
| `lib/memory.ts` | read/write `agent_memory`; recent-turns + semantic recall |
| `lib/agent.ts` | the decide→act→observe loop; calls retrieve + generate + memory |
| `app/api/agent/route.ts` | `POST { sessionId, message }` → runs loop, persists memory, returns answer + step trace |
| `app/agent/page.tsx` | chat UI that shows each loop step (the glass-box, for the agent) |
| `scripts/create-memory-index.mjs` | creates the `autoEmbed` index on `agent_memory` |

`lib/retrieve.ts` and `lib/generate.ts` are **unchanged** — the agent composes
them.

## Reasoning model

Ollama `qwen2.5-coder:14b` (same as the answer stage). The decision step uses a
strict JSON-only prompt; we parse it defensively and fall back to "answer" if the
model returns anything unparseable, so a bad LLM response never breaks the loop.
