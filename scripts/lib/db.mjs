// Shared config + connection helper for the demo scripts.
// Scripts are run with `node --env-file=.env`, so env vars are already loaded.
import { MongoClient } from "mongodb";

function required(name) {
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
  get mongoUri() {
    return required("MONGODB_URI");
  },
  dbName: process.env.MONGODB_DB || "code_aisle_demo",
  collectionName: process.env.MONGODB_COLLECTION || "code_chunks",
  vectorIndexName: process.env.VECTOR_INDEX_NAME || "code_auto_index",
  embedModel: process.env.EMBED_MODEL || "voyage-code-4",
  rerankModel: process.env.RERANK_MODEL || "rerank-2.5",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "qwen2.5-coder:7b",
};

/**
 * Connect to Atlas, run `fn(db, client)`, and always close the client.
 */
export async function withDb(fn) {
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  try {
    return await fn(client.db(config.dbName), client);
  } finally {
    await client.close();
  }
}
