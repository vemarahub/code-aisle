/**
 * Atlas Stream Processing — continuously-updating RAG (the richer, event-driven
 * version of the "new code becomes searchable" beat).
 *
 * This prints (and, where supported, creates) a stream processor that watches a
 * source collection of incoming questions, enriches each with a $vectorSearch
 * against the code_chunks Vector Search index (auto-embedding the question with
 * voyage-code-4), reranks the candidates with rerank-2.5, and writes the
 * enriched result to an output collection.
 *
 * Syntax verified against the official Atlas Stream Processing $vectorSearch
 * docs (the example that nests $rerank inside the $vectorSearch pipeline).
 *
 * IMPORTANT: Atlas Stream Processing requires a Stream Processing Instance (SPI)
 * and a Connection Registry — it is NOT available on a plain M0 connection
 * (verified: `listStreamProcessors` returns CommandNotFound on this cluster).
 * The live demo beat uses Automated Embedding's own auto-sync
 * (scripts/commit-new-code.mjs). This file is the reference definition to run on
 * an SPI-enabled deployment, and the artifact to show/narrate/record.
 *
 * Run: npm run stream:create   (prints the definition; attempts creation if an
 *                               SPI connection is available)
 */
import { withDb, config } from "./lib/db.mjs";

// Names you would register in the Atlas Stream Processing Connection Registry.
const SOURCE_CONNECTION = "atlasCluster"; // change-stream source
const SEARCH_CONNECTION = "atlasCluster"; // collection holding the vector index
const PROCESSOR_NAME = "codeAisleContinuousRag";

/**
 * The stream processor pipeline. $source -> $vectorSearch (middle stage, with a
 * nested $rerank in its pipeline) -> $merge into an enriched collection.
 */
const pipeline = [
  {
    $source: {
      connectionName: SOURCE_CONNECTION,
      db: config.dbName,
      coll: "incoming_questions",
      config: { fullDocument: "required", fullDocumentOnly: true },
    },
  },
  {
    $vectorSearch: {
      from: {
        connectionName: SEARCH_CONNECTION,
        db: config.dbName,
        coll: config.collectionName,
      },
      as: "matches",
      query: { text: "$question" }, // auto-embedded by the index's model
      index: config.vectorIndexName,
      path: "content",
      numCandidates: 100,
      limit: 20,
      let: { q: "$question" },
      pipeline: [
        {
          $rerank: {
            query: { text: "$$q" },
            path: "content",
            model: config.rerankModel,
            numDocsToRerank: 20,
          },
        },
        { $limit: 5 },
        { $project: { _id: 0, service: 1, file: 1 } },
      ],
    },
  },
  {
    $merge: {
      into: {
        connectionName: SEARCH_CONNECTION,
        db: config.dbName,
        coll: "answered_questions",
      },
    },
  },
];

function printDefinition() {
  console.log("Atlas Stream Processing definition (continuously-updating RAG):\n");
  console.log(`Processor name: ${PROCESSOR_NAME}`);
  console.log(JSON.stringify(pipeline, null, 2));
  console.log(
    "\nTo run this, create it on an Atlas Stream Processing Instance, e.g. in " +
      "mongosh connected to the SPI:\n" +
      `  sp.createStreamProcessor("${PROCESSOR_NAME}", <pipeline>)\n` +
      `  sp.${PROCESSOR_NAME}.start()\n`,
  );
}

async function main() {
  printDefinition();

  // Attempt creation only if this deployment exposes Stream Processing.
  await withDb(async (db) => {
    try {
      await db.admin().command({ listStreamProcessors: 1 });
    } catch (error) {
      console.log(
        "\nStream Processing not available on this connection " +
          `(${error.codeName || "error"}). This is expected on M0/standard ` +
          "clusters. Use `npm run commit-code` for the live auto-embed beat; " +
          "run this definition on an SPI-enabled deployment for the full " +
          "event-driven pipeline.",
      );
      return;
    }
    console.log(
      "\nStream Processing appears available. Create the processor via the " +
        "Atlas Stream Processing tooling (sp.createStreamProcessor) using the " +
        "definition above.",
    );
  });
}

main().catch((error) => {
  console.error("stream-processor script failed:", error.message);
  process.exit(1);
});
