import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import RedisIORedis from "ioredis";
import { REQUIRED_DB_NAME, REQUIRED_REDIS_DB_INDEX } from "./preflight";

/**
 * Harness code (per-package-plan.md section 5, steps 2/4/5): drops and
 * recreates the walkthrough's one dedicated database, applies migrations
 * and RLS, flushes the one Redis logical database it owns, and manages the
 * production server's lifecycle. This is infrastructure, not a journey
 * step — it never runs under tests/walkthrough/steps/ and is exempt from
 * the guard test for the same reason preflight.ts is.
 */

function assertRequiredDbName(databaseUrl: string): void {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");
  if (dbName !== REQUIRED_DB_NAME) {
    throw new Error(
      `stage.ts refuses to touch database "${dbName}" — only "${REQUIRED_DB_NAME}" may ever be dropped/recreated here.`,
    );
  }
}

/** Drops and recreates `databaseUrl`'s database, empty. Refuses any name but REQUIRED_DB_NAME. */
export async function recreateDatabase(databaseUrl: string): Promise<void> {
  assertRequiredDbName(databaseUrl);
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = "/postgres";

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [
      dbName,
    ]);
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }
}

/** Runs `prisma migrate deploy` then every prisma/rls/*.sql file, in name order, against databaseUrl. */
export function applyMigrationsAndRls(exportDir: string, databaseUrl: string): void {
  assertRequiredDbName(databaseUrl);
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: exportDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  const rlsDir = path.join(exportDir, "prisma", "rls");
  if (!fs.existsSync(rlsDir)) return;
  const files = fs
    .readdirSync(rlsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    execFileSync(
      "pnpm",
      ["exec", "prisma", "db", "execute", "--file", path.join(rlsDir, file), "--url", databaseUrl],
      { cwd: exportDir, stdio: "inherit" },
    );
  }
}

/** Flushes the one Redis logical database the walkthrough owns. Refuses any index but 15. */
export async function flushRedisTestDb(redisUrl: string): Promise<void> {
  const url = new URL(redisUrl);
  const dbIndex = Number(url.pathname.replace(/^\//, "") || "0");
  if (dbIndex !== REQUIRED_REDIS_DB_INDEX) {
    throw new Error(
      `stage.ts refuses to flush Redis logical database ${dbIndex} — only ${REQUIRED_REDIS_DB_INDEX} may ever be flushed here.`,
    );
  }
  const client = new RedisIORedis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await client.connect();
    await client.flushdb();
  } finally {
    client.disconnect();
  }
}

export type ServerHandle = {
  proc: ChildProcess;
  stop: () => Promise<void>;
};

/**
 * Starts the already-built production server (`next start -p <port>`) in
 * `cwd` and waits until it answers HTTP requests, or throws on timeout.
 */
export async function startProductionServer(opts: {
  cwd: string;
  port: number;
  env: Record<string, string | undefined>;
  readyPath?: string;
  timeoutMs?: number;
}): Promise<ServerHandle> {
  const { cwd, port, env, readyPath = "/", timeoutMs = 60_000 } = opts;

  const proc = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let exited = false;
  proc.once("exit", () => {
    exited = true;
  });

  const deadline = Date.now() + timeoutMs;
  const url = `http://localhost:${port}${readyPath}`;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`Production server at ${cwd} exited before it became ready (port ${port}).`);
    }
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) {
        return { proc, stop: () => stopServer(proc) };
      }
    } catch {
      // Not listening yet — retry until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await stopServer(proc);
  throw new Error(`Production server at ${cwd} did not become ready within ${timeoutMs}ms (port ${port}).`);
}

function stopServer(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.killed) {
      resolve();
      return;
    }
    proc.once("exit", () => resolve());
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }, 5000);
  });
}
