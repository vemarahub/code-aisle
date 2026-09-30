/**
 * Create the autoEmbed Vector Search index on the agent_memory collection.
 *
 * This powers the agent's long-term/semantic memory: MongoDB embeds each stored
 * conversation turn with voyage-code-4 and lets the agent vector-search its own
 * past turns. Same Automated Embedding pattern as the code corpus — no embedding
 * pipeline in the app.
 *
 * The collection must exist first (it's created on the first saved turn). If it
 * doesn't exist yet, this script creates it empty so the index can be built.
 *
 * Run: npm run create-memory-index
 */
import { withDb, config } from "./lib/db.mjs";

const indexDefinition = {
  name: config.memoryIndexName,
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "autoEmbed",
        modality: "text",
        path: "content",
        model: config.embedModel, // voyage-code-4
      },
      { type: "filter", path: "sessionId" },
      { type: "filter", path: "role" },
    ],
  },
};

async function main() {
  await withDb(async (db) => {
    // Ensure the collection exists so the index has something to attach to.
    const names = await db.listCollections({ name: config.memoryCollection }).toArray();
    if (names.length === 0) {
      await db.createCollection(config.memoryCollection);
      console.log(`Created empty collection ${config.memoryCollection}.`);
    }

    const coll = db.collection(config.memoryCollection);
    const existing = await coll
      .aggregate([{ $listSearchIndexes: { name: config.memoryIndexName } }])
      .toArray();

    if (existing.length > 0) {
      console.log(
        `Memory index "${config.memoryIndexName}" already exists (status: ${existing[0].status}).`,
      );
      return;
    }

    console.log(
      `Creating autoEmbed memory index "${config.memoryIndexName}" on ` +
        `${config.dbName}.${config.memoryCollection} using ${config.embedModel}...`,
    );
    const name = await coll.createSearchIndex(indexDefinition);
    console.log(`Requested creation of index: ${name}`);
    console.log("MongoDB will embed memory turns as they're written.");
  });
}

main().catch((error) => {
  console.error("Memory index creation failed:", error.message);
  process.exit(1);
});
