// LLM answer stage for the CLI — mirrors lib/generate.ts.
// Separate from retrieval: retrieved chunks in -> grounded answer out via Ollama.
import { config } from "./db.mjs";

function buildPrompt(question, hits) {
  const context = hits
    .map((h, i) => `[${i + 1}] ${h.file} (${h.service})\n${h.snippet}`)
    .join("\n\n");

  return [
    "You are a code-aware assistant. Answer the developer's question using ONLY",
    "the code snippets below, which were retrieved from the codebase by MongoDB",
    "Vector Search. Be concise (3-5 sentences). Cite the relevant file names.",
    "If the snippets don't contain the answer, say so.",
    "",
    `Question: ${question}`,
    "",
    "Retrieved code:",
    context,
    "",
    "Answer:",
  ].join("\n");
}

/** Never throws — returns { ok, answer, model, note? }. */
export async function generateAnswer(question, hits) {
  const model = config.ollamaModel;
  if (!hits || hits.length === 0) {
    return { ok: false, answer: "", model, note: "No code retrieved." };
  }
  try {
    const res = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: buildPrompt(question, hits), stream: false }),
    });
    if (!res.ok) {
      return { ok: false, answer: "", model, note: `Ollama returned ${res.status}.` };
    }
    const data = await res.json();
    return { ok: true, answer: (data.response ?? "").trim(), model };
  } catch {
    return {
      ok: false,
      answer: "",
      model,
      note: `Ollama not reachable at ${config.ollamaUrl}. Start it and retry.`,
    };
  }
}
