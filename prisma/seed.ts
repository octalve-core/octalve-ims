/**
 * Full-coverage demo seed — wipes DATABASE_URL and recreates every table
 * with >=4 rows each (see scripts/lib/seed-full-demo.ts for the fixture
 * design). For the smaller, stable "explore" fixtures the login dropdown
 * and e2e flows depend on, use `npm run script:reset-demo-db` instead.
 *
 * Usage:
 *   npm run script:seed-full-demo
 *   npx tsx prisma/seed.ts
 *   npx prisma db seed   (wired via package.json's "prisma.seed")
 */

import { PrismaClient } from "@prisma/client";
import { deleteAllDbData } from "../scripts/lib/delete-all-db-data";
import { seedFullDemo } from "../scripts/lib/seed-full-demo";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🌱 Full-coverage demo seed\n");
  console.log("   ⚠  This deletes ALL data in DATABASE_URL, then reseeds every table.\n");

  console.log("1️⃣  Wiping existing data...\n");
  const deleted = await deleteAllDbData(prisma);
  for (const [model, count] of Object.entries(deleted)) {
    console.log(`   ${model}: ${count}`);
  }

  console.log("\n2️⃣  Seeding every table (>=4 rows each)...\n");
  const counts = await seedFullDemo(prisma);
  for (const [model, count] of Object.entries(counts)) {
    console.log(`   ✅ ${model}: ${count}`);
  }

  console.log("\n✅ Done. Log in via the role dropdown:");
  console.log("   Admin:    test@admin.com    / 12345678");
  console.log("   Client:   test@client.com   / 12345678");
  console.log("   Supplier: test@supplier.com / 12345678");
  console.log("   Retailer: test@retailer.com / 12345678");
  console.log(
    "   Business-scoped: manager@nimbusretail.demo · lead@blueanchor.demo ·\n" +
      "   purchasing@solsticehw.demo · ops@vertexwholesale.demo (all / 12345678)\n",
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Error:", message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
