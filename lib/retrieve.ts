import type { Db } from "mongodb";
import { config } from "./config";

/**
 * Code-aware retrieval for the Next.js app. Mirrors scripts/lib/retrieve.mjs.
 *
 * Pipeline (the "2026 stack"):
 *   $vectorSearch (query TEXT auto-embedded by voyage-code-4)
 *     -> $addFields vectorScore
 *     -> $rerank (Voyage rerank-2.5)                          [8.3+ only]
 *     -> $addFields rerankScore
 *     -> $limit -> $project
 *
 * $rerank requires MongoDB 8.3+ with Native Reranking enabled. When it is not
 * available, we fall back to $vectorSearch-only ranking and set
 * `reranked: false` so the UI can tell the before/after story.
 */

const NUM_CANDIDATES = 100;
const VECTOR_LIMIT = 20;
const FINAL_LIMIT = 5;

export interface CodeHit {
  repository: string;
  service: string;
  file: string;
  name: string;
  type: string;
  language: string;
  snippet: string;
  vectorScore?: number;
  rerankScore?: number;
}

export interface RetrievalResult {
  reranked: boolean;
  results: CodeHit[];
  note?: string;
  question: string;
}

function vectorSearchStage(question: string) {
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
    snippet: { $substrCP: ["$content", 0, 240] },
    vectorScore: 1,
    rerankScore: 1,
  },
};

function rerankedPipeline(question: string) {
  return [
    vectorSearchStage(question),
    { $addFields: { vectorScore: { $meta: "vectorSearchScore" } } },
    {
      $rerank: {
        query: { text: question },
        path: "content",
        numDocsToRerank: VECTOR_LIMIT,
        model: config.rerankModel,
      },
    },
    { $addFields: { rerankScore: { $meta: "score" } } },
    { $limit: FINAL_LIMIT },
    projectStage,
  ];
}

function vectorOnlyPipeline(question: string) {
  return [
    vectorSearchStage(question),
    { $addFields: { vectorScore: { $meta: "vectorSearchScore" } } },
    { $limit: FINAL_LIMIT },
    projectStage,
  ];
}

function isRerankUnavailable(error: unknown): boolean {
  const msg = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
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

export async function retrieveCode(
  db: Db,
  question: string,
  useRerank: boolean = true,
): Promise<RetrievalResult> {
  const coll = db.collection(config.collectionName);

  // Explicitly requested vector-only (the demo toggle) — skip $rerank entirely.
  if (!useRerank) {
    const results = (await coll
      .aggregate(vectorOnlyPipeline(question))
      .toArray()) as CodeHit[];
    return {
      reranked: false,
      results,
      question,
      note: "Reranking off — showing raw $vectorSearch ranking.",
    };
  }

  try {
    const results = (await coll
      .aggregate(rerankedPipeline(question))
      .toArray()) as CodeHit[];
    return { reranked: true, results, question };
  } catch (error) {
    if (!isRerankUnavailable(error)) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    const results = (await coll
      .aggregate(vectorOnlyPipeline(question))
      .toArray()) as CodeHit[];
    return {
      reranked: false,
      results,
      question,
      note:
        "$rerank did not run — showing $vectorSearch ranking only. Reason: " +
        reason,
    };
  }
}
