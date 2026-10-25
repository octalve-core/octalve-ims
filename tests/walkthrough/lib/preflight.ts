import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Hard-exit gate (template section 2 / per-package-plan.md section 5 step 1):
 * every condition below must hold before a single browser action runs. Any
 * failure throws with a specific reason — never a silent downgrade, never a
 * retry. This module is infrastructure (lib/), not a journey step, so it is
 * outside the guard test's scope and is allowed to use pg/request-shaped
 * checks the journey itself never may.
 */

export const REQUIRED_DB_NAME = "octalve_ims_test";
export const REQUIRED_REDIS_DB_INDEX = 15;

export type PreflightResult = {
  commitSha: string;
  databaseHost: string;
  databaseName: string;
  baseUrl: string;
};

function fail(reason: string): never {
  throw new Error(`PREFLIGHT FAILED: ${reason}`);
}

function checkLocalHost(databaseUrl: string): { host: string } {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    fail(`DATABASE_URL is not a valid URL: ${databaseUrl}`);
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    fail(
      `DATABASE_URL host is "${url.hostname}", not localhost/127.0.0.1 — refusing ` +
        "to run the walkthrough against anything that isn't provably local.",
    );
  }
  const dbName = url.pathname.replace(/^\//, "");
  if (dbName !== REQUIRED_DB_NAME) {
    fail(`DATABASE_URL targets "${dbName}", not the required "${REQUIRED_DB_NAME}".`);
  }
  return { host: url.host };
}

function checkCleanGitTree(): string {
  const status = execSync("git status --short", { encoding: "utf8" }).trim();
  if (status.length > 0) {
    fail(`Git tree is not clean:\n${status}`);
  }
  return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
}

function checkLocalBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    fail(`BASE_URL is not a valid URL: ${baseUrl}`);
  }
  if (url.hostname !== "localhost") {
    fail(`BASE_URL host is "${url.hostname}", not localhost (Next blocks dev resources from 127.0.0.1).`);
  }
}

async function checkDatabaseEmpty(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query('SELECT count(*)::int AS n FROM "User"');
    const count = result.rows[0]?.n ?? -1;
    if (count !== 0) {
      fail(`Database "${REQUIRED_DB_NAME}" is not empty: ${count} row(s) in "User".`);
    }
  } finally {
    await client.end();
  }
}

export async function runPreflight(): Promise<PreflightResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is not set.");

  const baseUrl = process.env.WALKTHROUGH_BASE_URL || "http://localhost:3100";

  const { host } = checkLocalHost(databaseUrl!);
  checkLocalBaseUrl(baseUrl);
  const commitSha = checkCleanGitTree();
  await checkDatabaseEmpty(databaseUrl!);

  return {
    commitSha,
    databaseHost: host,
    databaseName: REQUIRED_DB_NAME,
    baseUrl,
  };
}
