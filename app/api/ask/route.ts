import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { retrieveCode } from "@/lib/retrieve";
import { generateAnswer } from "@/lib/generate";

export const dynamic = "force-dynamic";

/**
 * POST /api/ask  { question: string, generate?: boolean }
 *
 * Two clearly-separated stages:
 *   1. retrieveCode()  — MongoDB $vectorSearch (+ $rerank). Always runs.
 *   2. generateAnswer() — optional LLM stage (Ollama). Runs only if generate=true.
 *
 * This mirrors the demo narrative: retrieval is MongoDB; the LLM plugs in after.
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const withGeneration = body.generate === true;

    if (!question) {
      return NextResponse.json(
        { error: "Provide a non-empty 'question' string." },
        { status: 400 },
      );
    }

    const db = await getDb();

    // --- Stage 1: retrieval (MongoDB) ---
    const retrieval = await retrieveCode(db, question);
    const retrievalMs = Date.now() - started;

    // --- Stage 2: generation (Ollama), optional & separate ---
    const generation = withGeneration
      ? await generateAnswer(question, retrieval.results)
      : null;

    return NextResponse.json({
      ...retrieval,
      generation,
      retrievalMs,
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - started,
      },
      { status: 500 },
    );
  }
}
