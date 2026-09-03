import { defineConfig } from "prisma/config";

// A prisma.config.ts file present opts the CLI OUT of its old auto-.env-load
// behavior (package.json + prisma/schema.prisma mode did this implicitly) —
// load it ourselves via Node's native loader (Node 20.6+, no dotenv dep).
try {
  process.loadEnvFile(".env");
} catch {
  // .env absent (e.g. CI providing real env vars directly) — not fatal.
}

// Prisma CLI work (migrate/db push/studio) must go over a DIRECT, unpooled
// connection: a transaction-mode pooler (PgBouncer, Supabase :6543, Neon's
// -pooler host) can't hold the session-level advisory lock `migrate` takes,
// nor run its DDL. The app runtime is unaffected — prisma/client.ts's
// PrismaClient always reads DATABASE_URL via the schema's own datasource
// url, which is where the pooled URL belongs.
//
// Falls back to DATABASE_URL so a single-URL setup (local dev, a plain
// non-pooled Postgres) keeps working with no extra configuration.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

// Points the Prisma CLI at the split schema folder (prisma/schema/*.prisma —
// see prisma/schema/schema.prisma's header for why it's split this way).
export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Spread rather than always-set: `prisma generate` needs no database at
  // all, but prisma/config's `env()` helper throws at config-load time when
  // the var is unset — which would break a DB-less `postinstall` generate.
  // Omitting the key entirely lets generate run URL-free and still fails
  // loudly on migrate.
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
});
