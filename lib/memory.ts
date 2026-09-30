import type { Db } from "mongodb";
import { config } from "./config";

/**
 * Agent memory, backed by MongoDB. Two kinds:
 *  - short-term (conversational): the last N turns for a session, in order.
 *  - long-term (semantic): vector search over ALL past turns via the autoEmbed
 *    memory index, so the agent can recall relevant earlier discussion even
 *    from outside the recent window.
 *
 * One document per turn in `agent_memory`:
 *   { sessionId, role: "user" | "assistant", content, createdAt }
 * MongoDB owns the embeddings (Automated Embedding) — no embedding code here.
 */

export interface MemoryTurn {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

/** Append a turn to the conversation. */
export async function saveTurn(
  db: Db,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await db.collection(config.memoryCollection).insertOne({
    sessionId,
    role,
    content,
    createdAt: new Date(),
  });
}

/** Recent turns for a session, oldest→newest (short-term memory). */
export async function recentTurns(
  db: Db,
  sessionId: string,
  limit = 8,
): Promise<MemoryTurn[]> {
  const docs = await db
    .collection(config.memoryCollection)
    .find({ sessionId }, { projection: { _id: 0, embedding: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return (docs as unknown as MemoryTurn[]).reverse();
}

export interface RecalledMemory {
  content: string;
  role: string;
  sessionId: string;
  score: number;
}

/**
 * Semantic recall (long-term memory): vector-search past turns by meaning.
 * Excludes the current session by default so it surfaces *prior* context.
 * Returns [] if the memory index isn't ready yet (never throws).
 */
export async function recallMemory(
  db: Db,
  query: string,
  opts: { excludeSessionId?: string; limit?: number } = {},
): Promise<RecalledMemory[]> {
  const { excludeSessionId, limit = 3 } = opts;
  try {
    const pipeline: Record<string, unknown>[] = [
      {
        $vectorSearch: {
          index: config.memoryIndexName,
          path: "content",
          query, // TEXT — auto-embedded by MongoDB
          numCandidates: 50,
          limit: limit * 4,
        },
      },
      {
        $project: {
          _id: 0,
          content: 1,
          role: 1,
          sessionId: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];
    if (excludeSessionId) {
      pipeline.push({ $match: { sessionId: { $ne: excludeSessionId } } });
    }
    pipeline.push({ $limit: limit });

    return (await db
      .collection(config.memoryCollection)
      .aggregate(pipeline)
      .toArray()) as RecalledMemory[];
  } catch {
    // Memory index not created/ready — degrade gracefully.
    return [];
  }
}
