/**
 * ISS-0026 — delete-all-data.ts, reset-demo-db.ts and prisma/seed.ts all
 * wipe every row in whatever DATABASE_URL points to, with no check on what
 * that actually is. This repo's own .env (see docs/local-dev-setup.md)
 * commonly points at a shared hosted Neon instance that doubles as
 * staging, so a careless local run of any of them can nuke real shared
 * data, not an isolated local database.
 *
 * Auto-bypassed for CI (which seeds a disposable per-run localhost
 * database — see .github/workflows/ci.yml) and for an actual localhost/
 * 127.0.0.1 target. Anywhere else, requires typing the target host back
 * to proceed; CONFIRM_DESTRUCTIVE_DB_ACTION=1 skips the prompt for
 * scripted/non-interactive use once a human has already decided it's safe.
 */
import readline from "node:readline/promises";

function targetHost(databaseUrl: string | undefined): string {
  if (!databaseUrl) return "(no DATABASE_URL set)";
  try {
    return new URL(databaseUrl).host || "(unparseable DATABASE_URL)";
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function isLocalDbUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Prompts for confirmation before a full-database wipe; exits the process on abort. */
export async function confirmDestructiveDbAction(
  actionLabel: string,
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const host = targetHost(databaseUrl);

  if (process.env.CI || process.env.CONFIRM_DESTRUCTIVE_DB_ACTION === "1") {
    return;
  }
  if (isLocalDbUrl(databaseUrl)) {
    return;
  }

  console.log(`\n⚠️  About to ${actionLabel} on:\n\n   ${host}\n`);
  console.log(
    "   This is not localhost — it looks like a shared or hosted database.\n",
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(
    `   Type the host above ("${host}") to confirm, or anything else to abort: `,
  );
  rl.close();

  if (answer.trim() !== host) {
    console.log("\n❌ Aborted — confirmation did not match.\n");
    process.exit(1);
  }
}
