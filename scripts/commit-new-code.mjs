/**
 * Simulate a developer "committing" a new file to the codebase during the demo.
 *
 * Inserts a new MfaService.ts document into the auth-service. Because the
 * collection is indexed with Automated Embedding (autoEmbed), MongoDB detects
 * the new document, generates its embedding with voyage-code-4, and makes it
 * searchable automatically — no embedding pipeline, no manual reindex.
 *
 * This is the "continuously-updating RAG" beat, and it works on any Atlas
 * cluster with Automated Embedding (including free M0). The optional Atlas
 * Stream Processing pipeline (scripts/stream-processor.mjs) is the richer,
 * event-driven version of the same idea.
 *
 * Run: npm run commit-code
 *      npm run commit-code -- --remove   (undo, to reset before a re-run)
 */
import { withDb, config } from "./lib/db.mjs";

const REPOSITORY = "shop-platform";
const NEW_FILE = "auth-service/MfaService.ts";

const MFA_SOURCE = `/**
 * MfaService — multi-factor authentication (MFA) for customer login.
 *
 * Adds a second authentication factor on top of AuthService: generates and
 * verifies time-based one-time passcodes (TOTP), and manages enrollment of a
 * customer's authenticator device. This is where multi-factor authentication
 * and two-factor (2FA) verification are handled.
 */
import { AuthService, Session } from "./AuthService";

export interface MfaChallenge {
  customerId: string;
  challengeId: string;
  expiresAt: number;
}

export class MfaService {
  constructor(private readonly auth: AuthService) {}

  /** Begin an MFA challenge after a successful password login. */
  startChallenge(session: Session): MfaChallenge {
    return {
      customerId: session.customerId,
      challengeId: \`mfa_\${session.customerId}_\${Date.now()}\`,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
  }

  /** Verify the customer-supplied TOTP code for a challenge. */
  verifyCode(challenge: MfaChallenge, code: string): boolean {
    if (Date.now() > challenge.expiresAt) {
      throw new Error("MFA challenge expired");
    }
    return /^\\d{6}$/.test(code);
  }
}
`;

function inferType(content) {
  if (/\bclass\s+\w+/.test(content)) return "class";
  if (/\b(export\s+)?function\s+\w+/.test(content)) return "function";
  return "code";
}

async function main() {
  const remove = process.argv.includes("--remove");

  await withDb(async (db) => {
    const coll = db.collection(config.collectionName);

    if (remove) {
      const res = await coll.deleteOne({ repository: REPOSITORY, file: NEW_FILE });
      console.log(`Removed ${res.deletedCount} doc for ${NEW_FILE}. Ready for a fresh run.`);
      return;
    }

    const existing = await coll.findOne({ repository: REPOSITORY, file: NEW_FILE });
    if (existing) {
      console.log(
        `${NEW_FILE} already committed. Run \`npm run commit-code -- --remove\` first to reset.`,
      );
      return;
    }

    const doc = {
      repository: REPOSITORY,
      service: "auth-service",
      language: "typescript",
      file: NEW_FILE,
      name: "MfaService.ts",
      type: inferType(MFA_SOURCE),
      content: MFA_SOURCE,
      createdAt: new Date(),
    };

    await coll.insertOne(doc);
    console.log(`Committed new file: ${NEW_FILE}`);
    console.log(
      "Automated Embedding will now embed it with voyage-code-4 and make it " +
        "searchable automatically. Ask the MFA question again in a few seconds.",
    );
  });
}

main().catch((error) => {
  console.error("Commit failed:", error.message);
  process.exit(1);
});
