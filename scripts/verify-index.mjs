/**
 * Verify the autoEmbed Vector Search index is ready and that Automated
 * Embedding works end to end — WITHOUT the app ever computing an embedding.
 *
 * Steps:
 *   1. Poll $listSearchIndexes until the index is queryable.
 *   2. Run a $vectorSearch using a plain-TEXT query (auto-embedded by MongoDB).
 *   3. Print the ranked hits and their vectorSearchScore.
 *
 * Run: npm run verify-index
 */
import { withDb, config } from "./lib/db.mjs";

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 10 * 60 * 1000; // autoEmbed initial sync can take minutes
const PROBE_QUERY = "customer authentication and login";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getIndex(coll) {
  const list = await coll
    .aggregate([{ $listSearchIndexes: { name: config.vectorIndexName } }])
    .toArray();
  return list[0] ?? null;
}

async function waitUntilQueryable(coll) {
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    const idx = await getIndex(coll);
    if (!idx) {
      throw new Error(
        `Index "${config.vectorIndexName}" not found. Run \`npm run create-index\` first.`,
      );
    }
    const status = idx.status;
    const queryable = idx.queryable === true;
    console.log(
      `  status=${status} queryable=${queryable} (${Math.round((Date.now() - started) / 1000)}s)`,
    );
    if (queryable) return idx;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Timed out waiting for the index to become queryable.");
}

async function main() {
  await withDb(async (db) => {
    const coll = db.collection(config.collectionName);

    console.log(`Waiting for index "${config.vectorIndexName}" to be queryable...`);
    const idx = await waitUntilQueryable(coll);

    // Confirm it really is an autoEmbed index (Automated Embedding owns vectors).
    const fields = idx.latestDefinition?.fields ?? [];
    const autoEmbedField = fields.find((f) => f.type === "autoEmbed");
    console.log("\nIndex definition fields:");
    console.log(JSON.stringify(fields, null, 2));
    if (!autoEmbedField) {
      throw new Error(
        "Index is not an autoEmbed index — Automated Embedding is not active.",
      );
    }
    console.log(
      `\nConfirmed: autoEmbed on path "${autoEmbedField.path}" using model "${autoEmbedField.model}".`,
    );

    // Run a TEXT query — no client-side embedding. MongoDB embeds the query.
    console.log(`\nProbe $vectorSearch with plain text: "${PROBE_QUERY}"`);
    const results = await coll
      .aggregate([
        {
          $vectorSearch: {
            index: config.vectorIndexName,
            path: "content",
            query: PROBE_QUERY, // TEXT, not a vector
            numCandidates: 50,
            limit: 5,
          },
        },
        {
          $project: {
            _id: 0,
            service: 1,
            file: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray();

    if (results.length === 0) {
      throw new Error(
        "Probe returned 0 results. The index may still be embedding documents.",
      );
    }

    console.log("\nTop hits (auto-embedded query):");
    for (const r of results) {
      console.log(`  ${r.score.toFixed(4)}  ${r.file}  [${r.service}]`);
    }

    const topService = results[0].service;
    console.log(`\nTop result service: ${topService}`);
    console.log(
      topService === "auth-service"
        ? "PASS: auth-service ranked first for an authentication query."
        : "NOTE: top result was not auth-service — inspect ranking before the demo.",
    );
  });
}

main().catch((error) => {
  console.error("Verification failed:", error.message);
  process.exit(1);
});
