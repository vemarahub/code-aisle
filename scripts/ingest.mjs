/**
 * Ingest the toy multi-service corpus into the `code_chunks` collection.
 *
 * One document per file. Metadata: { repository, service, language, file, type,
 * content }. There is intentionally NO embedding field — Automated Embedding
 * (the autoEmbed Vector Search index) generates and manages vectors for us.
 *
 * Run: npm run ingest
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { withDb, config } from "./lib/db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, "..", "corpus");
const REPOSITORY = "shop-platform";

const LANGUAGE_BY_EXT = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".mjs": "javascript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
};

/** Recursively collect source files under a directory. */
async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)));
    } else if (LANGUAGE_BY_EXT[extname(entry.name)]) {
      files.push(full);
    }
  }
  return files;
}

/** Infer a coarse chunk "type" from the file contents. */
function inferType(content) {
  if (/\bclass\s+\w+/.test(content)) return "class";
  if (/\b(export\s+)?function\s+\w+/.test(content)) return "function";
  if (/\b(interface|type)\s+\w+/.test(content)) return "types";
  return "code";
}

async function buildDocuments(files) {
  const docs = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const rel = relative(CORPUS_DIR, file); // e.g. auth-service/AuthService.ts
    const service = rel.split(/[/\\]/)[0];
    docs.push({
      repository: REPOSITORY,
      service,
      language: LANGUAGE_BY_EXT[extname(file)],
      file: rel,
      name: basename(file),
      type: inferType(content),
      content,
      createdAt: new Date(),
    });
  }
  return docs;
}

async function main() {
  const stats = await stat(CORPUS_DIR).catch(() => null);
  if (!stats) {
    throw new Error(`Corpus directory not found: ${CORPUS_DIR}`);
  }

  const files = await collectFiles(CORPUS_DIR);
  const docs = await buildDocuments(files);

  await withDb(async (db) => {
    const coll = db.collection(config.collectionName);

    // Idempotent: clear only this repository's docs, then re-insert.
    const deleted = await coll.deleteMany({ repository: REPOSITORY });
    const result = await coll.insertMany(docs);
    const count = await coll.countDocuments({ repository: REPOSITORY });

    // Guard: ensure we never accidentally store an embedding field here.
    const withEmbedding = await coll.countDocuments({
      repository: REPOSITORY,
      embedding: { $exists: true },
    });

    console.log(`Ingestion into ${config.dbName}.${config.collectionName}:`);
    console.log(`  cleared previous : ${deleted.deletedCount}`);
    console.log(`  inserted         : ${result.insertedCount}`);
    console.log(`  total in repo    : ${count}`);
    console.log(`  docs w/ embedding: ${withEmbedding} (expected 0)`);
    console.log(`  services         : ${[...new Set(docs.map((d) => d.service))].join(", ")}`);

    const sample = await coll.findOne(
      { repository: REPOSITORY },
      { projection: { content: 0 } },
    );
    console.log("  sample doc (content omitted):");
    console.log("   ", JSON.stringify(sample));

    if (withEmbedding !== 0) {
      throw new Error(
        "Documents unexpectedly contain an embedding field. Automated " +
          "Embedding must own vectors — remove any embedding field from ingest.",
      );
    }
    if (count !== docs.length) {
      throw new Error(
        `Expected ${docs.length} docs in repo but found ${count}.`,
      );
    }
  });

  console.log("Ingestion complete.");
}

main().catch((error) => {
  console.error("Ingestion failed:", error.message);
  process.exit(1);
});
