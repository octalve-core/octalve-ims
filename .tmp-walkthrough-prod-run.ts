import {
  recreateDatabase, applyMigrationsAndRls, flushRedisTestDb, startProductionServer,
} from "@/tests/walkthrough/lib/stage";
import { provisionFirstAdmin } from "@/tests/walkthrough/lib/seed-admin";

const REPO_ROOT = "/home/rojitech/Desktop/CODEC/OCTALVE/ims";
const DATABASE_URL = process.env.WALKTHROUGH_DATABASE_URL!;
const REDIS_URL = "redis://localhost:6379/15";
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

async function main() {
  if (!DATABASE_URL) throw new Error("WALKTHROUGH_DATABASE_URL not set");
  console.log("Recreating database...");
  await recreateDatabase(DATABASE_URL);
  console.log("Applying migrations + RLS...");
  applyMigrationsAndRls(REPO_ROOT, DATABASE_URL);
  console.log("Flushing Redis db 15...");
  await flushRedisTestDb(REDIS_URL);
  console.log("Provisioning first admin...");
  await provisionFirstAdmin(DATABASE_URL);
  console.log("Starting production server...");
  const server = await startProductionServer({
    cwd: REPO_ROOT, port: PORT,
    env: { DATABASE_URL, REDIS_URL, NEXT_PUBLIC_API_URL: BASE_URL, NODE_ENV: "production" },
    timeoutMs: 60_000,
  });
  console.log("PROD SERVER READY on", BASE_URL);
  process.on("SIGTERM", async () => { await server.stop(); process.exit(0); });
}
main().catch((e) => { console.error(e); process.exit(1); });
