# Code Aisle — a code-aware agent on MongoDB Atlas

> **New here? Read [`demo/WALKTHROUGH.md`](demo/WALKTHROUGH.md) first** — one file
> that runs you through the steps and the implementation.
>
> **Single-page demo (feature branch):** one page with a **Setup · Search · RAG ·
> Agent** segmented control — the demo progression. Setup shows the behind-the-
> scenes MongoDB config; Search is `$vectorSearch` (+ `$rerank` toggle); RAG adds
> the LLM answer; Agent is the multi-turn code-aware agent (MongoDB = retrieval
> tool + memory). See [`demo/DEMO-SCRIPT.md`](demo/DEMO-SCRIPT.md) and
> [`demo/AGENT.md`](demo/AGENT.md).
>
> **The files that matter** (skip the toy corpus and UI scaffolding):
> - `scripts/ingest.mjs` — code → documents, **no embedding field**.
> - `scripts/create-index.mjs` — the `autoEmbed` index (MongoDB owns the vectors).
> - `lib/retrieve.ts` — the whole retrieval brain: `$vectorSearch → $rerank`.


A greenfield demo for a MongoDB `.local` session. It shows **MongoDB Atlas as the
operational + retrieval layer for a code-aware agent**, using Atlas AI
stack:

- **Automated Embeddings** — an `autoEmbed` Vector Search index; no embedding
  pipeline in the app. MongoDB generates/stores/updates the vectors.
- **Code-tuned retrieval** — the `voyage-code-4` embedding model.
- **Native reranking** — the `$rerank` aggregation stage (Voyage `rerank-2.5`).
- **Continuously-updating RAG** — Atlas Stream Processing keeps new code
  searchable in real time.


## Requirements (important)

This demo uses a **two-cluster strategy** — develop for free, provision paid
only for the reranking moment:

| Capability                              | Free M0 cluster | 8.3+ cluster |
| --------------------------------------- | :-------------: | :----------: |
| Code ingestion                          | ✅              | ✅           |
| Automated Embeddings (voyage-code-4)    | ✅              | ✅           |
| Vector Search (semantic code search)    | ✅              | ✅           |
| Code-aware agent (the app)              | ✅              | ✅           |
| Native reranking (`$rerank`)            | ❌ (needs 8.3+) | ✅           |

- Develop and rehearse everything on a **free M0 Atlas cluster**.
- Provision an **Atlas cluster on MongoDB 8.3+** (select "Latest version with
  auto-upgrades") and enable **Native Reranking** in **Project Settings** only
  when you want the live `$rerank` beat. Then point `MONGODB_URI` at it — no code
  change required.
- `voyage-code-4` and Automated Embedding (Preview) require an Atlas deployment
  (self-managed must use `voyage-code-3`).

**Confirmed empirically:** on a free M0 running MongoDB 8.0.32, Automated
Embeddings + voyage-code-4 + `$vectorSearch` all work; `$rerank` returns
`AtlasError: $rerank is not allowed`. The app detects this and falls back to
`$vectorSearch` ranking with `reranked: false`.

## End-to-end setup (read this to run/demo)

This is the complete path from a fresh clone to a running demo. Steps 3–6 are
one-time per cluster; after that you just `npm run dev`.

### 0. Prerequisites
- **Node 18+** and **npm**.
- A **MongoDB Atlas** cluster. For the full demo (with live `$rerank`) use an
  **M10+ on MongoDB 9.0** with **Native Reranking** enabled and a **Voyage model
  API key** on the project. A **free M0** runs everything *except* live `$rerank`
  (it falls back gracefully — see the two-cluster note below).
- **Ollama** running locally with `qwen2.5-coder:14b` pulled (for RAG + Agent
  answers). Not needed for plain Search.

### 1. Install
```bash
npm install
```

### 2. Configure `.env` (never committed)
```bash
cp .env.example .env      # then paste your Atlas URI + settings
```
`.env` holds demo-only values — no production secrets, no internal URLs.

### 3. Ingest the code corpus  →  creates & fills `code_chunks`
```bash
npm run ingest            # 9 documents, NO embedding field
```

### 4. Create the code vector index  →  Automated Embedding turns on here
```bash
npm run create-index      # autoEmbed index (voyage-code-4) on code_chunks
```

### 5. Create the agent memory index  →  the ONE agent-specific Atlas step
```bash
npm run create-memory-index   # creates the agent_memory collection + its autoEmbed index
```

### 6. Verify  →  proves auto-embedding works (waits for the index to build)
```bash
npm run verify-index      # polls until queryable, runs a text query, expects auth files on top
```

### 7. Start Ollama (for RAG + Agent)
```bash
docker start devaisle-ollama          # or: ollama serve
curl -s http://localhost:11434/api/tags | head -c 80    # confirm it's up
```

### 8. Run
```bash
npm run dev               # http://localhost:3070
```
Then walk the **Setup · Search · RAG · Agent** segments (see
[`demo/DEMO-SCRIPT.md`](demo/DEMO-SCRIPT.md)).

> **Tip:** pre-warm the LLM before demoing — `npm run retrieve -- --answer "warm up"` —
> or the first RAG/Agent answer runs ~18s cold instead of ~9s warm.

---

## What gets configured (and what does NOT)

| Piece | Where | How it's set up |
| --- | --- | --- |
| `code_chunks` collection | Atlas | created by `npm run ingest` (your code) |
| Code vector index (`autoEmbed`) | Atlas | `npm run create-index` |
| Automated Embedding | Atlas | comes *with* the autoEmbed index — no separate step |
| `$rerank` (Native Reranking) | Atlas | Project Setting + Voyage API key (M10/9.0) |
| `agent_memory` collection | Atlas | created by `npm run create-memory-index` (your code) |
| Agent memory index (`autoEmbed`) | Atlas | `npm run create-memory-index` |
| **Agent loop / logic** | **Code** | **nothing to "enable" — it's `lib/agent.ts`** |
| LLM (the reasoning) | Local | Ollama running `qwen2.5-coder:14b` |

**There is no "enable agent" switch.** An agent is not a MongoDB feature — it's
application code (`lib/agent.ts`) that uses a local LLM to *decide* and calls
MongoDB as its **retrieval tool** and its **memory**. The only Atlas-side thing
unique to the agent is the `agent_memory` autoEmbed index — the *same kind* of
index as the code one. Both `code_chunks` and `agent_memory` are ordinary
collections **your code creates**; the only MongoDB-managed collection is
`__mdb_internal_search`, where Atlas stores the generated vectors.

## How Automated Embedding stays in sync (important for the demo)

The autoEmbed index watches the **collection**, not your files on disk:

- **Editing a `corpus/*.ts` file does nothing by itself** — the document is the
  source of truth, not the file. Re-run `npm run ingest` to update the documents.
- **Insert a document** → MongoDB embeds it and adds a vector to
  `__mdb_internal_search` (this is the "commit new code" beat).
- **Update a document's `content`** → MongoDB detects the change and
  **re-embeds only that document** (delta detection), replacing its vector.
- **Delete a document** → its vector is removed.

Vectors are keyed to the source document's `_id` and kept in sync automatically —
you never read or write `__mdb_internal_search` yourself.

> Note: `npm run ingest` currently does `deleteMany` + `insertMany` (replaces the
> whole repo), so it re-embeds all docs. The true *per-document delta* is what
> `npm run commit-code` demonstrates (a single insert → single new vector).

## Two-cluster strategy (free vs. M10)

| Capability                              | Free M0 (8.0) | M10 (9.0) |
| --------------------------------------- | :-----------: | :-------: |
| Ingestion, Automated Embeddings         | ✅            | ✅        |
| Vector Search (semantic code search)    | ✅            | ✅        |
| RAG + Agent (app + Ollama)              | ✅            | ✅        |
| Native reranking (`$rerank`)            | ❌ fallback   | ✅ live   |

Develop/rehearse on the free M0; point `MONGODB_URI` at the M10 for the live
`$rerank` beat — **no code change**. When `$rerank` isn't available the app shows
`reranked: false` with the real reason and vector-only ranking.

## Environment variables

| Variable            | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `MONGODB_URI`       | Atlas connection string.                                |
| `MONGODB_DB`        | Demo database (default `code_aisle_demo`).              |
| `MONGODB_COLLECTION`| Corpus collection (default `code_chunks`).              |
| `VECTOR_INDEX_NAME` | Code `autoEmbed` index (default `code_auto_index`).     |
| `EMBED_MODEL`       | Voyage embedding model (default `voyage-code-4`).       |
| `RERANK_MODEL`      | Voyage reranker model (default `rerank-2.5`).           |
| `OLLAMA_URL`        | Ollama endpoint (default `http://localhost:11434`).     |
| `OLLAMA_MODEL`      | LLM for RAG/Agent (default `qwen2.5-coder:14b`).        |
| `MEMORY_COLLECTION` | Agent memory collection (default `agent_memory`).       |
| `MEMORY_INDEX_NAME` | Agent memory `autoEmbed` index (default `memory_auto_index`). |

## npm scripts

| Script                      | What it does                                          |
| --------------------------- | ----------------------------------------------------- |
| `npm run dev`               | Start the app on port 3070.                           |
| `npm run build`             | Production build.                                     |
| `npm run ingest`            | Ingest the toy corpus into `code_chunks`.             |
| `npm run create-index`      | Create the code `autoEmbed` Vector Search index.      |
| `npm run create-memory-index`| Create the `agent_memory` collection + autoEmbed index. |
| `npm run verify-index`      | Confirm the code index is active and auto-embedding works. |
| `npm run retrieve -- "<q>"` | CLI retrieval (`--no-rerank`, `--answer` flags).      |
| `npm run commit-code`       | Insert a new `MfaService.ts` doc (continuously-updating RAG). Use `-- --remove` to reset. |
| `npm run stream:create`     | Print the Atlas Stream Processing definition (SPI-only). |

## App routes

| Route          | What it is                                              |
| -------------- | ------------------------------------------------------- |
| `/`            | The unified demo — Setup · Search · RAG · Agent.        |
| `/api/setup`   | Live cluster state for the Setup view.                  |
| `/api/ask`     | Retrieval (+ optional LLM answer) for Search & RAG.     |
| `/api/agent`   | The agent loop (decide → retrieve → answer + memory).   |
| `/api/health`  | Atlas connection health check.                          |

## Architecture diagram (LikeC4)

The system is modeled in `diagrams/code-aisle.c4` (validated).

```bash
npx likec4 start diagrams                        # live interactive preview
npx likec4 export png -o diagrams/out diagrams   # static PNGs for the talk
npx likec4 validate diagrams                     # check the model parses
```

## The three "wows" + the agent

1. **Automated Embeddings (no pipeline)** — store plain code; MongoDB embeds it
   with voyage-code-4. Shown in Setup + Search.
2. **Code-aware retrieval + reranking** — `$vectorSearch → $rerank`. The `$rerank`
   toggle shows the before/after (score bars re-sort). Live on M10.
3. **Continuously-updating RAG** — `npm run commit-code` inserts a new file;
   Automated Embedding makes it searchable in seconds. `-- --remove` resets.
4. **Code-aware agent** — the Agent segment: an LLM decides when to search,
   MongoDB is its retrieval tool *and* its memory (conversation + semantic recall).
   See [`demo/AGENT.md`](demo/AGENT.md).

