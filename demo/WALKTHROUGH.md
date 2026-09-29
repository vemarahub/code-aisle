# Code Aisle — the one file to read

Read this end to end and you can run the demo and explain the implementation.
It links out to the deeper docs (`RUN-SHEET.md`, `CAREER-TALK.md`,
`FAILURE-SAFETY.md`, `DAY-OF-CHECKLIST.md`, `SESSION-RUNSHEET.md`).

---

## 1. What this is, in one paragraph

Code Aisle is a **code-aware agent**: you ask a codebase a question in plain
English and get back the most relevant source files, ranked by meaning. The
entire retrieval brain is **MongoDB Atlas** — the code, its metadata, the
embeddings, semantic search, and reranking all live in one place. There is **no
embedding pipeline, no separate vector database, and no glue services**.

## 2. The flow (what happens when you ask a question)

```
source files ──ingest──► code_chunks (documents, NO embedding field)
                              │
                    autoEmbed index (voyage-code-4)  ← MongoDB embeds & maintains vectors
                              │
your question ──► $vectorSearch ──► $rerank ──►  Stage 1: MongoDB returns ranked code
                  (auto-embeds       (rerank-2.5,        │
                   the query)         8.3+ only)         ▼
                                            Stage 2 (optional, pluggable):
                                            Ollama (qwen2.5-coder:14b) reads the
                                            retrieved code and writes the answer,
                                            citing the files.
```

**Two stages, one clean seam:** retrieval is 100% MongoDB. The LLM answer is a
separate, optional stage — toggle it off to show pure retrieval, on to show the
agent. If Ollama is down, retrieval still works.

## 3. The files that matter (implementation)

| File                       | What it does                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/ingest.mjs`       | Reads `corpus/` and inserts one document per file into `code_chunks` — `content` + metadata, **no embedding field**.            |
| `scripts/create-index.mjs` | Creates the `autoEmbed` Vector Search index (voyage-code-4). This is what makes MongoDB own the embeddings.                     |
| `lib/retrieve.ts`          | **Stage 1 — retrieval (MongoDB).** `$vectorSearch → $rerank → $project`, with a graceful fallback if `$rerank` isn't available. |
| `lib/generate.ts`          | **Stage 2 — the LLM answer (Ollama).** Separate & pluggable: retrieved code in → grounded answer out. Never throws.             |
| `app/api/ask/route.ts`     | Runs Stage 1 always; Stage 2 only if `generate:true`.                                                                           |
| `app/page.tsx`             | The browser UI — question box, LLM toggle, answer panel + ranked source files.                                                  |

Everything else is scaffolding (the toy corpus, config, connection helper).

## 4. Run it locally

> **Do steps 1–3 during pre-flight, NOT live.** After ingest, MongoDB needs
> ~15–30s to auto-embed before search works. Never re-ingest on stage.

```bash
cd code-aisle-demo
cp .env.example .env        # paste your Atlas URI (only needed once; .env is gitignored)
npm install

# --- start the local LLM (Stage 2) ---
docker start devaisle-ollama      # or: ollama serve   (needs qwen2.5-coder:14b pulled)
curl -s http://localhost:11434/api/tags   # confirm it's up

# --- pre-flight (before you're on stage) ---
npm run ingest              # 9 docs into code_chunks, 0 embeddings
npm run create-index        # create the autoEmbed index (first time only)
npm run verify-index        # waits until queryable; proves auth query ranks auth files first
npm run commit-code -- --remove   # make sure the "new file" beat starts absent

# --- the app (what you present) ---
npm run dev                 # open http://localhost:3070
```

CLI equivalent (rehearsal / fallback, not shown to audience):

```bash
npm run retrieve -- "Where is customer authentication handled?"            # retrieval only
npm run retrieve -- --answer "Where is customer authentication handled?"   # + LLM answer
```

## 5. The demo beats (present in the browser)

1. **Ingestion (show, don't run live):** open Compass/Atlas UI on `code_chunks`,
   open one document. "A code file stored as a document — `content` plus
   metadata, and no embedding field. MongoDB owns the vectors."
2. **Retrieval only (toggle LLM OFF):** click the auth preset → auth files rank
   top. "This is pure MongoDB — `$vectorSearch` found the right code by meaning,
   no embedding pipeline. But it's a _retriever_ — it gives me files."
3. **Plug in the LLM (toggle ON):** same question → an **Answer** panel appears
   above the files. "Now I plug in a local LLM. It reads the code MongoDB
   retrieved and answers the question, citing the files. MongoDB is the retrieval
   brain; the LLM is a swappable consumer." (~9s on 14b — narrate the wait:
   "retrieval took ~1.5s; the 14B model is now reading the code.")
4. **Wow #2 Reranking:** `reranked ✓` badge (8.3+ cluster) or narrate the
   one-stage `$rerank` add (free cluster).
5. **Wow #3 Continuously-updating RAG:** `npm run commit-code` (inserts a new
   `MfaService.ts` **document** — not a git commit, not a file edit) → re-ask the
   MFA question → it appears at #1 in ~5s. Reset with `npm run commit-code -- --remove`.

## 6. What the toy corpus is

`corpus/` is a **fake mini codebase** — 3 services, 9 files — that exists only to
be searched. Each file is a small stub with a deliberately **distinct purpose**
so semantic search returns obvious results. Tell the audience: _"This is stand-in
code; the point is the MongoDB retrieval, not the code itself."_

- **auth-service** — `AuthService.ts` (customer login/logout),
  `TokenManager.ts` (JWT access/refresh tokens), `PermissionValidator.ts` (RBAC).
- **payments-service** — `PaymentProcessor.ts` (charge + handle failed payments),
  `RefundHandler.ts` (refunds), `CurrencyConverter.ts` (currency conversion).
- **notifications-service** — `EmailSender.ts` (transactional email),
  `PushNotifier.ts` (mobile push), `TemplateRenderer.ts` (templating).
