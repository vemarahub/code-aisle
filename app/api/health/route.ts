import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Health check — pings Atlas and reports the demo's effective configuration
 * (model names, not secrets). Used in the demo to prove a live connection.
 */
export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    const ping = await db.command({ ping: 1 });
    const collections = await db.listCollections().toArray();

    return NextResponse.json({
      status: "ok",
      db: config.dbName,
      collection: config.collectionName,
      vectorIndex: config.vectorIndexName,
      embedModel: config.embedModel,
      rerankModel: config.rerankModel,
      pingOk: ping?.ok === 1,
      collections: collections.map((c) => c.name),
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - started,
      },
      { status: 500 },
    );
  }
}
