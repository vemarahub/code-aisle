import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { retrieveCode } from "@/lib/retrieve";

export const dynamic = "force-dynamic";

/**
 * POST /api/ask  { question: string }
 * Runs code-aware retrieval and returns ranked code chunks. The response
 * includes a `reranked` flag so the UI can show whether native $rerank ran.
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        { error: "Provide a non-empty 'question' string." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const result = await retrieveCode(db, question);

    return NextResponse.json({ ...result, latencyMs: Date.now() - started });
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
