import type { Db } from "mongodb";
import { config } from "./config";
import { retrieveCode, type CodeHit } from "./retrieve";
import { generateAnswer } from "./generate";
import { recentTurns, recallMemory, saveTurn } from "./memory";

/**
 * The agent loop: decide → act → observe, bounded.
 *
 * An LLM (Ollama) decides each step whether to RETRIEVE (optionally refining the
 * query) or ANSWER. Retrieval is the existing MongoDB tool (retrieveCode); the
 * answer is the existing generateAnswer. Memory (MongoDB) gives the agent the
 * conversation thread plus semantic recall of past turns.
 *
 * MongoDB is the agent's retrieval tool AND its memory. The LLM is the brain.
 * lib/retrieve.ts and lib/generate.ts are composed, never modified.
 */

const MAX_STEPS = 3;

export type AgentStep =
  | { type: "recall"; detail: string; recalled: string[] }
  | { type: "decide"; detail: string; action: "retrieve" | "answer" }
  | { type: "retrieve"; detail: string; query: string; files: string[] }
  | { type: "answer"; detail: string };

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  sources: CodeHit[];
  model: string;
}

/** Ask Ollama for a strict-JSON decision; fall back to "answer" on any trouble. */
async function decide(
  question: string,
  convo: string,
  recalled: string,
  lastFiles: string[],
  stepsLeft: number,
): Promise<{ action: "retrieve" | "answer"; query?: string }> {
  const prompt = [
    "You are a code-aware agent deciding your NEXT step. Reply with ONLY a JSON",
    'object, no prose. Either {"action":"retrieve","query":"<search text>"} to',
    'search the codebase, or {"action":"answer"} when you have enough context.',
    "Retrieve when you have no relevant code yet or need different code; refine",
    "the query to be specific. Answer once the retrieved code is sufficient.",
    stepsLeft <= 1 ? "You are on your LAST step — you must answer now." : "",
    "",
    recalled ? `Relevant past conversation:\n${recalled}\n` : "",
    convo ? `Conversation so far:\n${convo}\n` : "",
    lastFiles.length
      ? `Code already retrieved: ${lastFiles.join(", ")}`
      : "No code retrieved yet.",
    "",
    `Current question: ${question}`,
    "",
    "JSON decision:",
  ].join("\n");

  try {
    const res = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt,
        stream: false,
        format: "json", // ask Ollama to constrain output to JSON
      }),
    });
    if (!res.ok) return { action: "answer" };
    const data = (await res.json()) as { response?: string };
    const parsed = JSON.parse(data.response ?? "{}");
    if (parsed.action === "retrieve") {
      return { action: "retrieve", query: parsed.query || question };
    }
    return { action: "answer" };
  } catch {
    // Unparseable / model down / no Ollama → safe default.
    return { action: "answer" };
  }
}

function formatTurns(turns: { role: string; content: string }[]): string {
  return turns.map((t) => `${t.role}: ${t.content}`).join("\n");
}

/**
 * Run the agent for one user message. Persists both the user message and the
 * final answer to memory. Returns the answer plus a trace of the loop steps.
 */
export async function runAgent(
  db: Db,
  sessionId: string,
  message: string,
): Promise<AgentResult> {
  const steps: AgentStep[] = [];

  // Persist the user's message first (so it's part of memory).
  await saveTurn(db, sessionId, "user", message);

  // --- Memory: short-term thread + long-term semantic recall ---
  const turns = await recentTurns(db, sessionId, 8);
  const convo = formatTurns(turns);
  const recalled = await recallMemory(db, message, {
    excludeSessionId: sessionId,
    limit: 3,
  });
  if (recalled.length > 0) {
    steps.push({
      type: "recall",
      detail: `Recalled ${recalled.length} relevant past turn(s) from memory (semantic search).`,
      recalled: recalled.map((r) => r.content),
    });
  }
  const recalledText = recalled.map((r) => `${r.role}: ${r.content}`).join("\n");

  // --- The loop ---
  let sources: CodeHit[] = [];
  let lastFiles: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const stepsLeft = MAX_STEPS - step;
    const decision = await decide(message, convo, recalledText, lastFiles, stepsLeft);

    if (decision.action === "retrieve") {
      const query = decision.query || message;
      steps.push({
        type: "decide",
        action: "retrieve",
        detail: `Agent chose to search the codebase${
          query !== message ? ` (refined: "${query}")` : ""
        }.`,
      });
      const result = await retrieveCode(db, query, true);
      sources = result.results;
      lastFiles = sources.map((s) => s.file);
      steps.push({
        type: "retrieve",
        query,
        files: lastFiles,
        detail: `MongoDB returned ${lastFiles.length} file(s): ${lastFiles.join(", ")}`,
      });
      continue; // observe → decide again
    }

    // action === "answer"
    steps.push({
      type: "decide",
      action: "answer",
      detail: "Agent decided it has enough context to answer.",
    });
    break;
  }

  // --- Generate the grounded answer from whatever was retrieved ---
  const gen = await generateAnswer(message, sources);
  const answer = gen.ok
    ? gen.answer
    : sources.length
      ? "Retrieved relevant code but the answer model was unavailable. See sources below."
      : "I couldn't find relevant code for that question.";

  steps.push({
    type: "answer",
    detail: gen.ok
      ? `Answered with ${config.ollamaModel}, grounded in ${sources.length} retrieved file(s).`
      : gen.note ?? "Answer stage unavailable.",
  });

  // Persist the answer to memory (becomes recallable next time).
  await saveTurn(db, sessionId, "assistant", answer);

  return { answer, steps, sources, model: gen.model };
}
