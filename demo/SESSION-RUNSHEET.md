# Combined session run sheet — talk + demo

The full `.local` session in order, with the transition between the (no-slides)
career talk and the (screen-driven) demo. Read this top to bottom on the day.

Two parts, one session:
1. **Career talk** — "Careers Without a Map" (~13 min, no slides).
2. **Demo** — "MongoDB as the brain of a code-aware agent" (~7–10 min).

Detailed scripts live in:
- `demo/CAREER-TALK.md` — the talk, beat by beat.
- `demo/RUN-SHEET.md` — the demo, beat by beat, with narration.
- `demo/FAILURE-SAFETY.md` — recordings + contingencies.

---

## T-15 min — pre-flight (before you're on)

```bash
cd code-aisle-demo
npx next start -p 3070            # or npm run dev; leave running
curl -s http://localhost:3070/api/health | python3 -m json.tool   # expect status:"ok"
npm run verify-index             # index queryable + auth-first ranking
npm run commit-code -- --remove  # Wow #3 starts from "absent"
```

- Browser open at `http://localhost:3070`, font large.
- Terminal open in `code-aisle-demo/`, large font.
- Fallback recordings open in a media player, ready (see FAILURE-SAFETY.md).
- If using the paid 8.3+ cluster for live `$rerank`: confirm `.env` points at it
  and the health check says `ok`. Otherwise the demo runs on the free cluster and
  Beat 2 uses the vector-only narration.

## Part 1 — The talk (~13 min)

Deliver `demo/CAREER-TALK.md` from memory/notes. No slides. It ends on a
discussion prompt ("what's one 'unrelated' experience on your path?"). Let a few
people answer.

## The transition (~30 sec) — talk → demo

This line bridges the personal story into the technical demo and states the
positioning:

> "That reinvention I just described — going from DBA to backend to a new
> stack — is exactly the kind of thing I now lean on AI tooling to help me do
> faster. So let me show you something I built: a code-aware agent that helps
> you find your way around an unfamiliar codebase. And the whole brain of it is
> MongoDB — not as a bolt-on vector database, but as the operational **and**
> retrieval layer: the code, its metadata, the embeddings, and the reranking,
> all in one place."

Then move to the browser/terminal.

## Part 2 — The demo (~7–10 min)

Run the three beats from `demo/RUN-SHEET.md`:
1. **Automated Embeddings** — ask the auth question; no embedding pipeline.
2. **Code-aware reranking** — `$vectorSearch → $rerank` (reranked badge on 8.3+;
   vector-only narration on free).
3. **Continuously-updating RAG** — `npm run commit-code`, re-ask the MFA
   question, watch the new file appear at #1. Reset after with `--remove`.

Close with:

> "Code, metadata, embeddings, semantic search, reranking, live updates — one
> database, no glue. That's MongoDB as the retrieval layer for an AI agent."

## T+0 — after the session

- `npm run commit-code -- --remove` (leave state clean).
- Stop the dev server.
- **Rotate the Atlas DB user password** (it was shared in plaintext during
  setup) and update `.env`.
- If you spun up a paid 8.3+ cluster only for the booth, tear it down to avoid
  charges.

---

## One full timed rehearsal (do this once before the event)

1. Deliver the talk aloud, timed — target ≤15 min.
2. Say the transition line.
3. Run all three demo beats end to end against the cluster you'll use live.
4. Simulate "no wifi": disable network mid-beat and confirm you can pivot to the
   recording and keep talking without breaking stride.
5. Reset state. You're ready.

## Session status snapshot (what's live vs. narrated)

| Beat | Free M0 | Paid 8.3+ |
| --- | --- | --- |
| Talk | n/a | n/a |
| Wow #1 Automated Embeddings | ✅ live | ✅ live |
| Wow #2 `$rerank` | narrated + recorded | ✅ live |
| Wow #3 continuously-updating RAG | ✅ live (~5s) | ✅ live |
