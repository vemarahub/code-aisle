import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/setup — real cluster state for the "Setup / behind the scenes" view.
 * Returns the collections, both autoEmbed indexes (code + memory) with status,
 * and the configured models — so the Setup screen shows live values, not mocks.
 */
export async function GET() {
  try {
    const db = await getDb();

    async function indexInfo(coll: string, indexName: string) {
      try {
        const list = await db
          .collection(coll)
          .aggregate([{ $listSearchIndexes: { name: indexName } }])
          .toArray();
        const idx = list[0];
        return {
          exists: !!idx,
          status: idx?.status ?? "MISSING",
          queryable: idx?.queryable ?? false,
        };
      } catch {
        return { exists: false, status: "UNKNOWN", queryable: false };
      }
    }

    const [codeCount, memoryCount, codeIdx, memIdx] = await Promise.all([
      db.collection(config.collectionName).countDocuments().catch(() => 0),
      db.collection(config.memoryCollection).countDocuments().catch(() => 0),
      indexInfo(config.collectionName, config.vectorIndexName),
      indexInfo(config.memoryCollection, config.memoryIndexName),
    ]);

    return NextResponse.json({
      embedModel: config.embedModel,
      rerankModel: config.rerankModel,
      llmModel: config.ollamaModel,
      code: {
        collection: config.collectionName,
        index: config.vectorIndexName,
        count: codeCount,
        ...codeIdx,
      },
      memory: {
        collection: config.memoryCollection,
        index: config.memoryIndexName,
        count: memoryCount,
        ...memIdx,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
