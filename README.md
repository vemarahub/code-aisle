# Code Aisle — a code-aware agent on MongoDB Atlas

A greenfield demo for a MongoDB `.local` session. It shows **MongoDB Atlas as the
operational + retrieval layer for a code-aware agent**, using Atlas AI
stack:

- **Automated Embeddings** — an `autoEmbed` Vector Search index; no embedding
  pipeline in the app. MongoDB generates/stores/updates the vectors.
- **Code-tuned retrieval** — the `voyage-code-4` embedding model.
- **Native reranking** — the `$rerank` aggregation stage (Voyage `rerank-2.5`).
- **Continuously-updating RAG** — Atlas Stream Processing keeps new code
  searchable in real time.

> Positioning: this is **not** "MongoDB as a vector database." It's MongoDB as
> the single place where your application data, metadata, embeddings, and
> retrieval live together.

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

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env file and fill in your **throwaway** Atlas cluster values:
   ```bash
   cp .env.example .env
   ```
   `.env` holds demo-only values — no production secrets, no internal URLs.
3. Verify the connection:
   ```bash
   npm run dev            # then open http://localhost:3070/api/health
   ```
   A healthy response returns `status: "ok"` and the effective model config.

## Environment variables

| Variable            | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `MONGODB_URI`       | Throwaway Atlas connection string (Atlas 8.3+).         |
| `MONGODB_DB`        | Demo database (default `code_aisle_demo`).              |
| `MONGODB_COLLECTION`| Corpus collection (default `code_chunks`).              |
| `VECTOR_INDEX_NAME` | `autoEmbed` index name (default `code_auto_index`).     |
| `EMBED_MODEL`       | Voyage embedding model (default `voyage-code-4`).       |
| `RERANK_MODEL`      | Voyage reranker model (default `rerank-2.5`).           |

## Project structure

```
app/
  page.tsx              # Home (agent UI added in a later step)
  api/health/route.ts   # Atlas connection health check
lib/
  config.ts             # Env-driven config (app side)
  mongodb.ts            # Lazy, cached Atlas connection (app side)
scripts/
  lib/db.mjs            # Config + connection helper (scripts side)
```

## npm scripts

| Script                 | What it does                                             |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Start the app on port 3070.                              |
| `npm run build`        | Production build.                                        |
| `npm run ingest`       | Ingest the toy repo corpus into `code_chunks`.           |
| `npm run create-index` | Create the `autoEmbed` Vector Search index.              |
| `npm run verify-index` | Confirm the index is active and auto-embedding works.    |
| `npm run retrieve`     | Run the `$vectorSearch` → `$rerank` retrieval from CLI.  |
| `npm run commit-code`  | "Commit" a new code file (Stream Processing demo).       |
| `npm run stream:create`| Create the Atlas Stream Processor.                       |

## Demo flow (order)

1. `npm run ingest` — load the toy corpus into `code_chunks` (no vectors).
2. `npm run create-index` — create the `autoEmbed` index (voyage-code-4).
3. `npm run verify-index` — poll until queryable, then prove that a plain
   **text** query is auto-embedded and returns the right code. No embedding
   code runs in the app — MongoDB owns the vectors.
4. `npm run retrieve "<question>"` — full `$vectorSearch` → `$rerank` retrieval.

## The three "wows"

1. **Automated Embeddings (no pipeline)** — `create-index` + `verify-index`
   show MongoDB embedding code with voyage-code-4; the app never computes a
   vector. Works on free M0.
2. **Code-aware retrieval** — `$vectorSearch` → `$rerank` (voyage `rerank-2.5`).
   The app shows a `reranked ✓` badge when native reranking runs (8.3+ cluster);
   otherwise it falls back to vector-only ranking with a `vector-only` badge.
3. **Continuously-updating RAG** — `npm run commit-code` inserts a new
   `auth-service/MfaService.ts`. Because the collection uses Automated Embedding,
   MongoDB re-embeds and makes it searchable automatically. Ask the MFA question
   before and after: the new file jumps to #1 within seconds. No reindex, no
   pipeline. `npm run commit-code -- --remove` resets it.
   - The event-driven version (Atlas Stream Processing) is in
     `scripts/stream-processor.mjs` — a verified definition to run on an SPI-
     enabled deployment (not available on M0).

