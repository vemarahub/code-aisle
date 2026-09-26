/**
 * Central demo configuration, read from environment variables.
 *
 * All values are demo-only. There are intentionally no secrets or internal
 * company URLs hard-coded here — everything comes from a local `.env`.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and fill in your throwaway Atlas values.`,
    );
  }
  return value;
}

export const config = {
  /** Throwaway Atlas connection string (Atlas 8.3+ required for $rerank). */
  get mongoUri(): string {
    return required("MONGODB_URI");
  },
  /** Demo database name. */
  get dbName(): string {
    return process.env.MONGODB_DB || "code_aisle_demo";
  },
  /** Source collection holding the code corpus. */
  get collectionName(): string {
    return process.env.MONGODB_COLLECTION || "code_chunks";
  },
  /** autoEmbed Vector Search index name. */
  get vectorIndexName(): string {
    return process.env.VECTOR_INDEX_NAME || "code_auto_index";
  },
  /** Voyage AI embedding model (code-optimized). */
  get embedModel(): string {
    return process.env.EMBED_MODEL || "voyage-code-4";
  },
  /** Voyage AI reranker model for $rerank. */
  get rerankModel(): string {
    return process.env.RERANK_MODEL || "rerank-2.5";
  },
} as const;
