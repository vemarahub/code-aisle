# Day-of rehearsal checklist — one page

Run the demo **locally** and project your screen. GitHub is the backup, not the
runtime. Print or open this on a second device.

---

## The night before

- [ ] `git pull` on the demo machine so the code is current.
- [ ] **Recreate `.env`** — it is gitignored, so it is NOT in the clone:
      `cp .env.example .env` then paste your Atlas URI + settings.
- [ ] `npm install` (clean machine) — confirm it finishes with 0 vulns.
- [ ] Decide which cluster `MONGODB_URI` points at:
      - Free M0 → Wow #2 reranking shows the `vector-only` badge (narrate it).
      - Paid 8.3+ with Native Reranking on → Wow #2 shows `reranked ✓` live.
- [ ] Capture the fallback recordings (see `FAILURE-SAFETY.md`), stored locally.
- [ ] Full timed rehearsal once, including the no-wifi drill.

## T-15 min (before you're on)

```bash
cd code-aisle-demo
npm run dev                                   # leave running on :3070
curl -s http://localhost:3070/api/health | python3 -m json.tool   # expect status:"ok"
docker start devaisle-ollama                  # start local LLM (or: ollama serve)
curl -s http://localhost:11434/api/tags | head -c 120   # confirm qwen2.5-coder:14b is up
npm run ingest                                # 9 docs, 0 with embedding
npm run verify-index                          # waits for READY, auth-first ranking
npm run commit-code -- --remove               # Wow #3 starts "absent"
```

- [ ] Browser open at `http://localhost:3070`, font large.
- [ ] Terminal open in `code-aisle-demo/`, large font.
- [ ] Fallback recordings open in a player, ready.
- [ ] Phone hotspot on standby (Atlas + Voyage need outbound HTTPS).

## Talk → demo transition (say this)

> "That reinvention I described — DBA to backend to a new stack — is exactly
> what I now lean on AI tooling to do faster. Here's a code-aware agent I built,
> and its whole brain is MongoDB: not a bolt-on vector database, but the
> operational **and** retrieval layer — code, metadata, embeddings, reranking,
> all in one place."

## The three beats (details in RUN-SHEET.md)

- [ ] **Wow #1 — Automated Embeddings.** Ask the auth preset. "No embedding
      pipeline — MongoDB embeds with voyage-code-4."
- [ ] **Wow #2 — `$rerank`.** `reranked ✓` (8.3+) or narrate the one-stage add
      (free). Show `lib/retrieve.ts` rerank stage if narrating.
- [ ] **Wow #3 — Continuously-updating RAG.** Ask MFA (absent) → `npm run
      commit-code` → ask again (~5s) → `MfaService.ts` is #1. Reset after.

## Close (say this)

> "Code, metadata, embeddings, semantic search, reranking, live updates — one
> database, no glue. That's MongoDB as the retrieval layer for an AI agent."

## Reset commands (if a beat drifts mid-demo)

```bash
npm run commit-code -- --remove     # remove the MFA file
npm run ingest                      # reload the 9 base docs
npm run verify-index                # confirm queryable + auth-first
# nuclear option (rebuild everything, ~2 min):
npm run ingest && npm run create-index && npm run verify-index
```

## Fallback cues (don't debug on stage)

- Query stalls >10s → cut to the recording, keep narrating.
- `vector-only` badge on the paid cluster → Native Reranking not enabled;
  use the free-cluster narration + recording #1.
- `MfaService.ts` doesn't appear → wait ~5–10s, re-ask once, else recording #3.
- Health check not `ok` → switch to hotspot; don't start beats until `ok`.

## After the session

- [ ] `npm run commit-code -- --remove` (leave state clean).
- [ ] Stop the dev server.
- [ ] **Rotate the Atlas DB password** (shared in plaintext during setup) and
      update `.env`.
- [ ] If you spun up a paid 8.3+ cluster just for the booth, tear it down.
