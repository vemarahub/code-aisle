import { MongoClient, Db } from "mongodb";
import { config } from "./config";

/**
 * Lazily-created, cached MongoClient for the Next.js app.
 *
 * The client is created on first use (not at import time) so that importing
 * this module never triggers a connection or requires env vars — important
 * during Next.js build-time page-data collection. In development, Next.js
 * clears the module cache on hot reloads, so we stash the promise on
 * `globalThis` to avoid exhausting connections during a demo session.
 */
declare global {
  var _codeAisleMongo: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!global._codeAisleMongo) {
    global._codeAisleMongo = new MongoClient(config.mongoUri).connect();
  }
  return global._codeAisleMongo;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(config.dbName);
}

export async function getClient(): Promise<MongoClient> {
  return getClientPromise();
}
