/**
 * Code-aware retrieval, shared by the CLI script and the Next.js API route
 * (the API route re-implements the same shape in TypeScript against lib/).
 *
 * Pipeline (the "2026 stack"):
 *   $vectorSearch (query TEXT auto-embedded by voyage-code-4)
 *     -> $addFields vectorScore
 *     -> $rerank (Voyage rerank-2.5, code-aware reordering)   [8.3+ only]
 *     -> $addFields rerankScore
 *     -> $limit
 *     -> $project
 *
 * $rerank requires MongoDB 8.3+ with Native Reranking enabled. If it is not
 * available, we gracefully fall back to $vectorSearch-only ranking and flag
 * `reranked: false` so callers (and the demo) can explain the difference.
 */
import { config } from "./db.mjs";

const NUM_CANDIDATES = 100;
const VECTOR_LIMIT = 20; // candidates fed into the reranker
const FINAL_LIMIT = 5;

/** Base $vectorSearch stage using auto-embedding (query is TEXT). */
function vectorSearchStage(question) {
  return {
    $vectorSearch: {
      index: config.vectorIndexName,
      path: "content",
      query: question, // TEXT — MongoDB embeds it with voyage-code-4
      numCandidates: NUM_CANDIDATES,
      limit: VECTOR_LIMIT,
    },
  };
}

const projectStage = {
  $project: {
    _id: 0,
    repository: 1,
    service: 1,
    file: 1,
    name: 1,
    type: 1,
    language: 1,
    // A short snippet keeps payloads small and the UI legible.
    snippet: { $substrCP: ["$content", 0, 240] },
    vectorScore: 1,
    rerankScore: 1,
  },
};

/** Reranked pipeline (requires MongoDB 8.3+ + Native Reranking). */
function rerankedPipeline(question) {
  return [
    vectorSearchStage(question),
    { $addFields: { vectorScore: { $meta: "vectorSearchScore" } } },
    {
      $rerank: {
        query: { text: question },
        path: "content",
        numDocsToRerank: VECTOR_LIMIT,
        model: config.rerankModel, // rerank-2.5
      },
    },
    { $addFields: { rerankScore: { $meta: "score" } } },
    { $limit: FINAL_LIMIT },
    projectStage,
  ];
}

/** Fallback pipeline: $vectorSearch only (works on 8.0+). */
function vectorOnlyPipeline(question) {
  return [
    vectorSearchStage(question),
    { $addFields: { vectorScore: { $meta: "vectorSearchScore" } } },
    { $limit: FINAL_LIMIT },
    projectStage,
  ];
}

/**
 * Signals that $rerank isn't available on this deployment (version too low,
 * feature not enabled, or unsupported deployment type) rather than a real bug.
 */
function isRerankUnavailable(error) {
  const msg = (error && error.message ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("rerank") ||
    msg.includes("unrecognized") ||
    msg.includes("not allowed") ||
    msg.includes("not enabled") ||
    msg.includes("unsupported") ||
    msg.includes("mmsapierror") ||
    msg.includes("voyage_api_key") ||
    msg.includes("8.3") ||
    msg.includes("native reranking")
  );
}

/**
 * Run code-aware retrieval for a natural-language question.
 * @param {boolean} [useRerank=true] set false to force raw $vectorSearch ranking.
 * @returns {Promise<{ reranked: boolean, results: object[], note?: string }>}
 */
export async function retrieveCode(db, question, useRerank = true) {
  const coll = db.collection(config.collectionName);

  if (!useRerank) {
    const results = await coll.aggregate(vectorOnlyPipeline(question)).toArray();
    return {
      reranked: false,
      results,
      note: "Reranking off — showing raw $vectorSearch ranking.",
    };
  }

  try {
    const results = await coll.aggregate(rerankedPipeline(question)).toArray();
    return { reranked: true, results };
  } catch (error) {
    if (!isRerankUnavailable(error)) {
      throw error; // a real error — don't hide it
    }
    const reason = error && error.message ? error.message : String(error);
    const results = await coll.aggregate(vectorOnlyPipeline(question)).toArray();
    return {
      reranked: false,
      results,
      note:
        "$rerank did not run — showing $vectorSearch ranking only. Reason: " +
        reason,
    };
  }
}

export const retrievalConstants = { NUM_CANDIDATES, VECTOR_LIMIT, FINAL_LIMIT };
