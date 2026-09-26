import { config } from "./config";
import type { CodeHit } from "./retrieve";

/**
 * The LLM answer stage — deliberately SEPARATE from retrieval.
 *
 * Retrieval (lib/retrieve.ts) is 100% MongoDB. This module is the pluggable
 * "second half": it takes the code that MongoDB retrieved and asks a local
 * Ollama model to answer the question, grounded in that code. Swap the model,
 * turn it off, or replace it entirely without touching retrieval.
 *
 * The seam is one function: retrieved chunks in -> grounded answer out.
 */

export interface GenerationResult {
  answer: string;
  model: string;
  ok: boolean;
  note?: string;
}

/** Build a grounded prompt: the question + the code MongoDB retrieved. */
function buildPrompt(question: string, hits: CodeHit[]): string {
  const context = hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.file} (${h.service})\n${h.snippet}`,
    )
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

/**
 * Generate an answer from the retrieved code via Ollama.
 * Never throws — if Ollama is unreachable, returns { ok: false } so the app
 * still shows retrieval results (graceful degradation for the live demo).
 */
export async function generateAnswer(
  question: string,
  hits: CodeHit[],
): Promise<GenerationResult> {
  const model = config.ollamaModel;

  if (hits.length === 0) {
    return { answer: "", model, ok: false, note: "No code retrieved to answer from." };
  }

  try {
    const res = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(question, hits),
        stream: false,
      }),
    });

    if (!res.ok) {
      return {
        answer: "",
        model,
        ok: false,
        note: `Ollama returned ${res.status}. Retrieval still works; the LLM stage is optional.`,
      };
    }

    const data = (await res.json()) as { response?: string };
    return { answer: (data.response ?? "").trim(), model, ok: true };
  } catch {
    return {
      answer: "",
      model,
      ok: false,
      note:
        `Ollama not reachable at ${config.ollamaUrl}. Start it (docker start ` +
        `devaisle-ollama, or 'ollama serve') to enable the answer stage.`,
    };
  }
}
