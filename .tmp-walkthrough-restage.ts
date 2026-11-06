import { recreateDatabase, applyMigrationsAndRls, flushRedisTestDb } from "@/tests/walkthrough/lib/stage";
import { provisionFirstAdmin } from "@/tests/walkthrough/lib/seed-admin";

const REPO_ROOT = "/home/rojitech/Desktop/CODEC/OCTALVE/ims";
const DATABASE_URL = process.env.WALKTHROUGH_DATABASE_URL!;
const REDIS_URL = "redis://localhost:6379/15";

async function main() {
  if (!DATABASE_URL) throw new Error("WALKTHROUGH_DATABASE_URL not set");
  await recreateDatabase(DATABASE_URL);
  applyMigrationsAndRls(REPO_ROOT, DATABASE_URL);
  await flushRedisTestDb(REDIS_URL);
  await provisionFirstAdmin(DATABASE_URL);
  console.log("STAGE READY");
}
main().catch((e) => { console.error(e); process.exit(1); });
