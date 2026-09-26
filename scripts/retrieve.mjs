/**
 * CLI for code-aware retrieval — the "ask the codebase" demo from the terminal.
 *
 * Runs the reranked pipeline ($vectorSearch -> $rerank) when available, and
 * also shows the vector-only ranking so you can see what reranking changed.
 *
 * Run: npm run retrieve -- "Where is customer authentication handled?"
 */
import { withDb, config } from "./lib/db.mjs";
import { retrieveCode } from "./lib/retrieve.mjs";
import { generateAnswer } from "./lib/generate.mjs";

const DEFAULT_QUESTION =
  "Where is customer authentication handled, and what would I change to add MFA?";

function printResults(title, results, scoreKey) {
  console.log(`\n${title}`);
  results.forEach((r, i) => {
    const score = r[scoreKey];
    const scoreStr = typeof score === "number" ? score.toFixed(4) : "  --  ";
    console.log(`  ${i + 1}. ${scoreStr}  ${r.file}  [${r.service}]`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const withAnswer = args.includes("--answer");
  const question = args.filter((a) => a !== "--answer").join(" ").trim() || DEFAULT_QUESTION;

  await withDb(async (db) => {
    console.log(`Question: "${question}"`);
    console.log(`Index: ${config.vectorIndexName}  |  embed: ${config.embedModel}  |  rerank: ${config.rerankModel}`);

    const { reranked, results, note } = await retrieveCode(db, question);

    if (reranked) {
      printResults("Reranked results ($vectorSearch -> $rerank):", results, "rerankScore");
      console.log("\n(reranked: true — Voyage rerank-2.5 reordered the candidates)");
    } else {
      printResults("Vector-only results ($vectorSearch):", results, "vectorScore");
      console.log(`\n(reranked: false — ${note})`);
    }

    if (results.length === 0) {
      throw new Error("No results returned — is the index built and populated?");
    }

    // Optional, SEPARATE LLM stage — turns the retrieved code into an answer.
    if (withAnswer) {
      console.log(`\n--- LLM answer stage (Ollama · ${config.ollamaModel}) ---`);
      const gen = await generateAnswer(question, results);
      console.log(gen.ok ? `\n${gen.answer}` : `\n(LLM unavailable — ${gen.note})`);
    }
  });
}

main().catch((error) => {
  console.error("Retrieval failed:", error.message);
  process.exit(1);
});
