# Demo run sheet — "MongoDB as the brain of a code-aware agent"

Total demo time: ~7–10 min. Positioning line (say it once, up front):

> "This isn't 'MongoDB as a vector database.' It's MongoDB as the operational
> **and** retrieval layer for a code-aware agent — the code, its metadata, the
> embeddings, and the reranking all live in one place."

---

## Pre-flight (before you walk up) — do this 10 min before

Run from `code-aisle-demo/`:

```bash
# 1. Confirm the cluster + config are healthy
npm run build          # optional sanity; should already be built
npx next start -p 3070 # or `npm run dev`; leave running in a terminal

# 2. In a second terminal, confirm Atlas connection
curl -s http://localhost:3070/api/health | python3 -m json.tool
#   expect status:"ok", embedModel:"voyage-code-4", rerankModel:"rerank-2.5"

# 3. Make sure the corpus is loaded and the index is queryable
npm run ingest         # 9 docs, 0 with embedding
npm run verify-index   # waits for READY, prints auth-first ranking

# 4. Reset the "new code" beat so it starts absent
npm run commit-code -- --remove
```

Open two things on screen:
- Browser at `http://localhost:3070` (the agent UI).
- A terminal (large font) in `code-aisle-demo/`.
- (Optional) MongoDB Compass or Atlas UI on the `code_aisle_demo.code_chunks`
  collection + the `code_auto_index` definition.

---

## Beat 1 — Automated Embeddings (Wow #1) · ~2 min

**Show:** the `code_chunks` collection in Compass/Atlas + the `code_auto_index`
definition (type `autoEmbed`, model `voyage-code-4`).

**Do:** in the app, click the preset **"Where is customer authentication
handled…"** → results show auth-service files on top.

**Say:**
> "I never wrote an embedding pipeline. I stored plain code, pointed a
> MongoDB `autoEmbed` index at the `content` field with the code-tuned
> `voyage-code-4` model, and MongoDB generates and maintains the vectors. I
> typed a plain-English question — MongoDB embedded the *query* too and ranked
> the code by meaning."

---

## Beat 2 — Code-aware retrieval + native reranking (Wow #2) · ~3 min

**On the 8.3+ cluster** (Native Reranking enabled): the results show the green
**`reranked ✓ ($vectorSearch → $rerank)`** badge.

**Say:**
> "Retrieval is two MongoDB stages: `$vectorSearch` finds candidates, then
> `$rerank` — native reranking with a Voyage model — reorders them for
> relevance, right in the aggregation pipeline. No extra service."

**On the free M0 cluster** (fallback): the badge reads **`vector-only`**.
**Say:**
> "On this free cluster I'm showing `$vectorSearch` ranking. Add one stage —
> `$rerank` — on an 8.3+ cluster and the same query reorders for quality.
> Here's that one-line pipeline addition." (Show `lib/retrieve.ts` rerank stage,
> or the recorded reranked run.)

---

## Beat 3 — Continuously-updating RAG (Wow #3) · ~2 min

**Do (live):**
```bash
# Ask BEFORE (MFA file absent) — in the app or:
npm run retrieve -- "How is multi-factor authentication (MFA) handled?"

# "Commit" a new file
npm run commit-code

# Ask again after ~5s — MfaService.ts is now #1
npm run retrieve -- "How is multi-factor authentication (MFA) handled?"
```

**Say:**
> "A teammate just committed a new MFA service. I didn't reindex or re-embed
> anything — because the index uses Automated Embedding, MongoDB detected the
> new document, embedded it, and made it searchable in seconds. That's
> continuously-updating RAG. The event-driven version uses Atlas Stream
> Processing" (show `scripts/stream-processor.mjs` definition).

**Reset after:** `npm run commit-code -- --remove`

---

## Close (~30s)

> "Code, metadata, embeddings, semantic search, reranking, and live updates —
> one database, no glue services. That's what I mean by MongoDB as the
> retrieval layer for an AI agent."
