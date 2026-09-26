# Failure-safety kit

A live demo on venue wifi against a cloud database has three failure surfaces:
network, cluster/feature availability, and demo-state drift. This is the plan
for each, plus the recordings to capture beforehand.

## Golden rule

Every live beat has a **pre-recorded fallback**. If anything stalls for more
than ~10 seconds, cut to the recording and keep narrating. Never debug on stage.

---

## Recordings to capture BEFORE the event (do these on a good network)

Record short screen captures (30–60s each), in this priority order:

1. **Reranked run on the 8.3+ cluster** — the whole point of Wow #2. Capture the
   app showing the green `reranked ✓` badge and the reordered results. This is
   the single most important recording, because reranking depends on the paid
   cluster being healthy.
2. **The full 3-beat happy path** — Wow #1 (auto-embed search), Wow #2
   (rerank), Wow #3 (commit → appears). This is your total-outage fallback: if
   wifi dies entirely, you narrate over this.
3. **Wow #3 before/after** — MFA question empty, `npm run commit-code`, MFA
   question showing `MfaService.ts` at #1. (Verified live latency ≈ 5s, but a
   recording removes timing risk.)
4. **Stream Processing** — `npm run stream:create` output + (if you have an SPI)
   the processor running. This beat is narrated/recorded by design.

Store recordings locally on the demo machine (not streamed from the cloud).

---

## Network contingencies

| Symptom | Action |
| --- | --- |
| Wifi flaky, queries slow (>10s) | Switch to phone hotspot; Atlas + Voyage need outbound HTTPS. |
| No network at all | Cut to recording #2 (full happy path), narrate over it. |
| `/api/health` shows `status:"error"` | Check hotspot; re-run `curl …/api/health`. Don't proceed to beats until `ok`. |
| Voyage rate-limit error on a query | Wait a few seconds and re-ask (embedding is per-query); or cut to recording. |

## Cluster / feature contingencies

| Symptom | Meaning | Action |
| --- | --- | --- |
| Badge shows `vector-only` on the paid cluster | Native Reranking not enabled, or cluster <8.3 | Use the free-cluster narration for Beat 2; show `lib/retrieve.ts` + recording #1. |
| `$rerank … is not allowed` in CLI | Same as above | Expected on free M0. It's the fallback, not a crash. |
| Index not `queryable` | autoEmbed still building | `npm run verify-index` waits; if it stalls, use a recording. |
| `MfaService.ts` doesn't appear after commit | auto-embed sync lag | Wait ~5–10s and re-ask once; else cut to recording #3. |
| **Answer panel says "LLM not reachable"** | Ollama not started / wrong port | `docker start devaisle-ollama` (or `ollama serve`); retrieval still shows — toggle LLM off and narrate, or cut to recording. |
| **LLM answer very slow (>20s)** | 14b under memory pressure / cold model | Pre-warm before the talk (ask one question during pre-flight); or switch `OLLAMA_MODEL` to `qwen2.5-coder:7b` for speed. |

## Demo-state drift (reset procedures)

Run these to return to a known-clean state before (re)starting:

```bash
npm run commit-code -- --remove   # remove the MFA file (Beat 3 starts absent)
npm run ingest                    # re-load the 9 base docs if anything changed
npm run verify-index              # confirm index queryable + auth-first ranking
```

If the collection or index gets into a weird state, the whole demo can be
rebuilt from scratch in ~2 min:

```bash
npm run ingest && npm run create-index && npm run verify-index
```

---

## The one thing not to forget

After the event, **rotate the Atlas database user password** — it was shared in
plaintext during setup. Atlas UI → Database Access → edit user → new password.
The app only needs `.env` updated with the new URI.
