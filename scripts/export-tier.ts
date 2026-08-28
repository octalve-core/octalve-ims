/**
 * Copies this private monorepo into a stripped, sellable tier export
 * (Core, Pro, or Premium) driven by tier-manifest.json — the mechanism
 * behind the "monorepo + tier-gated export" packaging decision (Milestone 0
 * plan, Step 7). Each tier is additive: Core = shared+core, Pro =
 * shared+core+pro, Premium = shared+core+pro+premium.
 *
 * Usage: tsx scripts/export-tier.ts <core|pro|premium> [outDir]
 * (wired as `pnpm export:core` / `export:pro` / `export:premium`)
 *
 * This only copies files — it does not install dependencies or run a build.
 * Verify an export by hand after running it: cd into outDir, `pnpm install`,
 * `npx tsc --noEmit`. A clean typecheck is the real proof the tier boundary
 * holds; this script's own checks below are a much cheaper first pass.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const TIERS = ["core", "pro", "premium"] as const;
type Tier = (typeof TIERS)[number];

const tierArg = process.argv[2];
if (!tierArg || !TIERS.includes(tierArg as Tier)) {
  console.error(`Usage: tsx scripts/export-tier.ts <${TIERS.join("|")}> [outDir]`);
  process.exit(1);
}
const tier = tierArg as Tier;
const outDir = path.resolve(process.argv[3] ?? path.join(ROOT, "..", `octalve-ims-${tier}`));

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tier-manifest.json"), "utf8"),
) as Record<string, string[]>;

// shared, always included; then everything up to and including `tier` in the
// core ⊂ pro ⊂ premium chain.
const BUCKET_ORDER = ["shared", "core", "pro", "premium"] as const;
const includedBuckets = BUCKET_ORDER.slice(0, BUCKET_ORDER.indexOf(tier) + 1);
const excludedBuckets = BUCKET_ORDER.filter((b) => !includedBuckets.includes(b));

/**
 * Internal-only files — never ship in ANY tier export even though they sit
 * in the "shared" bucket. "shared" in tier-manifest.json means "always
 * included in every tier's app code", not "safe to hand to a customer" —
 * these two files are meta-tooling ABOUT the export process itself.
 */
const INTERNAL_ONLY = new Set(["tier-manifest.json", "eslint.tier-boundaries.mjs"]);

/** Root-level items outside tier-manifest.json's tracked scope (app/lib/
 * components/hooks/types/contexts/stores/utils/middleware) that every
 * export still needs to actually install and build. */
const ALWAYS_COPY_ROOT = [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "next-env.d.ts",
  "global.d.ts",
  "next.config.ts",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "components.json",
  "eslint.config.mjs",
  ".eslintrc.json",
  "vitest.config.ts",
  "vercel.json",
  "sentry.client.config.ts",
  "sentry.edge.config.ts",
  "sentry.server.config.ts",
  "instrumentation.ts",
  "instrumentation-client.ts",
  "proxy.ts",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  ".env.example",
  ".gitignore",
  "public",
  "docs",
  "scripts",
];

/** Never copy, even under an ALWAYS_COPY_ROOT directory (e.g. scripts/). */
const ALWAYS_EXCLUDE = new Set<string>([
  "node_modules",
  ".next",
  ".git",
  "tsconfig.tsbuildinfo",
  ".env",
  "scripts/export-tier.ts",
  "scripts/check-tier-manifest-coverage.ts",
  "CLAUDE.md",
]);

/**
 * Per-tier file-variant override: a file `Foo.tsx` may have a sibling
 * `Foo.core.tsx` / `Foo.pro.tsx` / `Foo.premium.tsx` that replaces it (under
 * the ORIGINAL name) when exporting that exact tier — for a static import
 * that tier genuinely can't satisfy (see tier-manifest.json's "KNOWN REAL
 * GAP" notes). A variant file is never copied under its own suffixed name.
 *
 * Deliberately NO cross-tier fallback (e.g. a Pro export reusing a `.core.`
 * variant when no `.pro.` exists): tried that, and it silently mis-strips
 * files whose only coupling is to a PRO-bucketed dependency (Pro already
 * has it, so Pro should get the default file) the same way as files coupled
 * to a PREMIUM-only dependency (Pro lacks it too, so Pro needs the stripped
 * variant) — the export script can't tell those two cases apart from the
 * filename alone. Exact-tier-only is unambiguous; where a premium-only
 * dependency means both Core and Pro need the same stripped content (e.g.
 * category-forecast-rollup), author both `.core.tsx` and `.pro.tsx`
 * explicitly (duplicated content, not a hidden inference).
 */
const VARIANT_RE = /\.(core|pro|premium)(\.[jt]sx?)$/;

function resolveSource(relPath: string): string {
  const ext = path.extname(relPath);
  const base = relPath.slice(0, -ext.length);
  const variantAbs = path.join(ROOT, `${base}.${tier}${ext}`);
  return fs.existsSync(variantAbs) ? variantAbs : path.join(ROOT, relPath);
}

function copyFileWithVariant(relPath: string) {
  if (ALWAYS_EXCLUDE.has(relPath) || VARIANT_RE.test(relPath)) return;
  const dest = path.join(outDir, relPath); // dest keeps the ORIGINAL (un-suffixed) name
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(resolveSource(relPath), dest);
}

function walkFiles(absDir: string, relDir: string): string[] {
  const out: string[] = [];
  for (const child of fs.readdirSync(absDir, { withFileTypes: true })) {
    const relChild = `${relDir}/${child.name}`;
    if (ALWAYS_EXCLUDE.has(relChild)) continue;
    if (child.isDirectory()) {
      out.push(...walkFiles(path.join(absDir, child.name), relChild));
    } else {
      out.push(relChild);
    }
  }
  return out;
}

function copyPath(relSrc: string) {
  if (ALWAYS_EXCLUDE.has(relSrc) || INTERNAL_ONLY.has(relSrc)) return;
  const src = path.join(ROOT, relSrc);
  if (!fs.existsSync(src)) return; // manifest entries can reference dead/removed paths (e.g. deleted middleware/)
  if (fs.statSync(src).isDirectory()) {
    for (const relFile of walkFiles(src, relSrc)) copyFileWithVariant(relFile);
  } else {
    copyFileWithVariant(relSrc);
  }
}

console.log(`Exporting tier "${tier}" -> ${outDir}`);
console.log(`Buckets included: ${includedBuckets.join(", ")}`);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let copiedCount = 0;
for (const bucket of includedBuckets) {
  for (const entry of manifest[bucket] ?? []) {
    copyPath(entry);
    copiedCount++;
  }
}
for (const entry of ALWAYS_COPY_ROOT) copyPath(entry);

// Sanity check: nothing from an excluded bucket should exist in the output
// — catches a copy bug or a manifest entry that's a parent of an excluded
// path, not a substitute for the tsc/build proof mentioned above.
const leaks: string[] = [];
for (const bucket of excludedBuckets) {
  for (const entry of manifest[bucket] ?? []) {
    if (fs.existsSync(path.join(outDir, entry))) leaks.push(`${entry} (bucket: ${bucket})`);
  }
}

console.log(`Copied ${copiedCount} manifest entries + ${ALWAYS_COPY_ROOT.length} always-copy root items.`);
if (leaks.length > 0) {
  console.error(`\nLEAK: found ${excludedBuckets.join("/")} paths in the ${tier} export:`);
  for (const l of leaks) console.error(`  - ${l}`);
  process.exit(1);
}
console.log(`OK — no ${excludedBuckets.join("/")} paths leaked into the ${tier} export.`);
console.log(`\nNext: cd ${path.relative(ROOT, outDir) || outDir} && pnpm install && npx tsc --noEmit`);
