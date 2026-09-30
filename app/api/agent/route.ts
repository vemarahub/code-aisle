import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { runAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent  { sessionId: string, message: string }
 *
 * Runs the decide→act→observe agent loop. MongoDB is the retrieval tool and the
 * memory store; the loop persists the conversation and returns the answer plus a
 * trace of the steps the agent took (recall / decide / retrieve / answer).
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : "default";

    if (!message) {
      return NextResponse.json(
        { error: "Provide a non-empty 'message' string." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const result = await runAgent(db, sessionId, message);

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
