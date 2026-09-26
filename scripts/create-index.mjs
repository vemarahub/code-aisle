/**
 * Create the autoEmbed Vector Search index on the `code_chunks` collection.
 *
 * With Automated Embedding, MongoDB generates and manages the vectors itself —
 * there is no embedding pipeline in this app. We index the `content` text field
 * with the voyage-code-4 code-optimized model, and index `service` as a filter
 * field so retrieval can be scoped per service.
 *
 * Run: npm run create-index
 */
import { withDb, config } from "./lib/db.mjs";

const indexDefinition = {
  name: config.vectorIndexName,
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "autoEmbed",
        modality: "text",
        path: "content",
        model: config.embedModel, // voyage-code-4
      },
      { type: "filter", path: "service" },
      { type: "filter", path: "repository" },
    ],
  },
};

async function main() {
  await withDb(async (db) => {
    const coll = db.collection(config.collectionName);

    const existing = await coll
      .aggregate([{ $listSearchIndexes: { name: config.vectorIndexName } }])
      .toArray();

    if (existing.length > 0) {
      console.log(
        `Index "${config.vectorIndexName}" already exists (status: ${existing[0].status}). ` +
          `Drop it first if you want to recreate it.`,
      );
      return;
    }

    console.log(
      `Creating autoEmbed vector index "${config.vectorIndexName}" ` +
        `on ${config.dbName}.${config.collectionName} using model ${config.embedModel}...`,
    );
    console.log(JSON.stringify(indexDefinition, null, 2));

    const name = await coll.createSearchIndex(indexDefinition);
    console.log(`Requested creation of index: ${name}`);
    console.log(
      "MongoDB is now generating embeddings and building the index. " +
        "Run `npm run verify-index` to poll until it is queryable.",
    );
  });
}

main().catch((error) => {
  console.error("Index creation failed:", error.message);
  process.exit(1);
});
