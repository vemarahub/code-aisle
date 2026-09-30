# Code Aisle — 10-minute demo run-of-show

**Story:** *From a search box to an agent, one MongoDB layer at a time.* One page,
one segmented control (**Setup · Search · RAG · Agent**), one sample codebase.
Each segment adds one capability — and every layer is MongoDB Atlas.

Positioning line (say once, at the start):

> "This is MongoDB as the operational **and** retrieval layer for AI — code,
> embeddings, search, reranking, and agent memory, all in one database. No
> separate vector DB, no embedding pipeline, no glue."

Open on `http://localhost:3070`. Walk the segmented control left → right.

---

## Pre-flight (before you're on) — ~5 min before

Point `.env` at the **M10 / 9.0.3** cluster (rerank is live there).

```bash
npm run dev                                        # http://localhost:3070
docker start devaisle-ollama                       # or: ollama serve
curl -s http://localhost:11434/api/tags | head -c 80   # LLM up?
# data + indexes (first time on this cluster only):
npm run ingest            # 9 code docs
npm run create-index      # autoEmbed on code_chunks
npm run create-memory-index
npm run verify-index      # wait until queryable
# PRE-WARM the LLM so the first answer isn't slow (~9s cold):
npm run retrieve -- --answer "warm up"
```

Nothing to do for the Voyage key — it's already registered on this project
(rerank returning `reranked: true` proves it).

---

## Act 0 — Setup segment (~2 min) · "the configuration, and behind the scenes"

Click **Setup**. Walk the visual map:

- Two collections — **`code_chunks`** and **`agent_memory`** — each labeled
  *"no vector field."*
- Both flow through **`autoEmbed · voyage-code-4`** into **`__mdb_internal_search`**.
- Capability badges: **`$vectorSearch`**, **`$rerank · rerank-2.5`**, **`LLM`**.

> "That's the whole setup. I store plain documents; MongoDB generates and
> maintains the vectors in its own internal store with voyage-code-4. Same
> pattern twice — once for the code, once for the agent's memory. No pipeline."

---

## Act 1 — Search, rerank OFF (~1.5 min) · "search by meaning"

Click **Search**, untick **$rerank**. Ask preset *"Where is customer
authentication handled?"*

- The flow lights up: question → `$vectorSearch` → results.
- Score bars show the ranking; auth files on top.

> "I typed plain English. MongoDB embedded my question with voyage-code-4 and
> found the code by meaning — no keywords, no embedding code on my side."

---

## Act 2 — Search, rerank ON (~1.5 min) · "the before/after"

Tick **$rerank**, ask the same question again.

- The score bars **re-sort and sharpen** — the top match pulls clearly ahead.

> "One more stage — `$rerank`, a Voyage reranker — reorders by true relevance,
> right in the aggregation pipeline. Watch the bars: the best answer separates
> from the pack. Still zero extra services."

---

## Act 3 — RAG (~2 min) · "now it answers"

Click **RAG**. Ask the auth question.

- Flow now ends in an **LLM answer** box; an **Answer** panel appears, citing
  files; the retrieved code shows as sources below.

> "So far MongoDB gave me the right *files* — a retriever. Now I plug a local LLM
> onto exactly that retrieved code. It doesn't search — MongoDB does — it
> explains. That's RAG: retrieval is MongoDB, generation is the LLM."

(~9s on 14b — narrate the wait: "MongoDB retrieved in ~1.5s; the local model is
reading the code now.")

---

## Act 4 — Agent (~2.5 min) · "it decides and remembers"

Click **Agent**. Use the Set A presets in order:

1. *"Where is customer authentication handled?"*
   - Watch **AGENT STEPS**: decide → retrieve → answer. Note it often **refines**
     the query itself.
2. *"What would I change **there** to add MFA?"*
   - "there" has no meaning alone — the agent resolves it to AuthService.ts
     **from memory**, refines, retrieves again, answers.

> "Now the LLM decides *when* to search, and MongoDB is also its memory — the
> conversation and semantic recall of past turns. 'There' only works because it
> remembered. Code, search, rerank, and memory: one database."

(Optional: show `agent_memory` filling up in Compass as you chat.)

---

## Close (~0.5 min)

> "We climbed from a search box to an agent, and every layer was MongoDB Atlas —
> retrieval, reranking, and the agent's memory. That's the operational and
> retrieval layer for AI, with no glue in between."

---

## Timings & safety

| Beat | ~time | live-risk |
| --- | --- | --- |
| Setup | 2m | none (reads state) |
| Search off/on | 3m | low |
| RAG | 2m | LLM ~9s (pre-warmed) |
| Agent (2 turns) | 2.5m | ~18s/turn (2 LLM calls) |

- **Pre-warm the 14b model** or the first answer drags (cold ≈ 18s vs warm ≈ 9s).
- If **$rerank** shows fallback: you're on the wrong cluster/project — point
  `.env` at the M10. Narrate the "add one stage" story if you can't switch.
- If **Ollama** is down: Search still works; RAG/Agent answers degrade with a
  clear note — retrieval never depends on the LLM.
- Reset agent memory between rehearsals if desired:
  `db.agent_memory.deleteMany({ sessionId: /^web-/ })` in mongosh.
