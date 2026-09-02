/**
 * Fails (non-zero exit) if any top-level app/lib/components file or folder,
 * or any loose file directly under app-root-adjacent dirs (hooks/, types/,
 * contexts/, stores/, utils/, middleware/), isn't classified in exactly one
 * bucket of tier-manifest.json.
 *
 * Run after every manifest edit: `pnpm check:manifest`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tier-manifest.json"), "utf8")
);

const BUCKETS = ["shared", "core", "pro", "premium"] as const;
const allEntries = new Set<string>();
const seenIn: Record<string, string[]> = {};

for (const bucket of BUCKETS) {
  for (const entry of manifest[bucket] ?? []) {
    allEntries.add(entry);
    (seenIn[entry] ??= []).push(bucket);
  }
}

// Directories whose immediate children (files and folders) must each be
// classified individually (loose-file dirs), vs. directories whose immediate
// child *folders* are the classification unit and files inside don't need
// individual listing (folder-level dirs).
const FOLDER_LEVEL_DIRS = ["app/admin", "app/api", "app/api/admin", "lib", "lib/server", "lib/insights", "lib/payments", "components", "hooks/queries", "components/Pages", "components/admin"];
const LOOSE_FILE_DIRS = ["hooks", "types", "contexts", "stores", "utils", "middleware", "prisma"];
// app/ itself: children are a MIX of folders (classified as whole units,
// e.g. "app/orders") and two special single files (layout.tsx, page.tsx,
// globals.css etc. at the app root) which aren't tier-relevant and are
// implicitly always shared — skip bare files directly under app/.

const missing: string[] = [];
const duplicates: string[] = [];

// A per-tier file-variant override (e.g. Foo.core.tsx alongside Foo.tsx,
// picked by scripts/export-tier.ts) — an override of its base file, not an
// independently classified unit; it inherits the base's bucket.
const VARIANT_RE = /\.(core|pro|premium)(\.[jt]sx?)$/;

function checkDir(dir: string, mode: "folder" | "loose") {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  for (const child of fs.readdirSync(abs, { withFileTypes: true })) {
    if (child.name.startsWith(".")) continue;
    if (VARIANT_RE.test(child.name)) continue;
    const rel = `${dir}/${child.name}`;
    // a subfolder that is itself independently walked (its own FOLDER_LEVEL_DIRS
    // entry) is expanded into per-file entries there — don't also require the
    // folder's own name to appear as a manifest entry here.
    if (child.isDirectory() && FOLDER_LEVEL_DIRS.includes(rel)) continue;
    if (mode === "folder" && child.isFile()) {
      // a loose file sitting inside a folder-level dir (e.g. lib/utils.ts) —
      // must be classified individually, same as a loose-file dir entry.
      if (!allEntries.has(rel)) missing.push(rel);
      continue;
    }
    if (!allEntries.has(rel)) missing.push(rel);
  }
}

for (const dir of FOLDER_LEVEL_DIRS) checkDir(dir, "folder");
for (const dir of LOOSE_FILE_DIRS) checkDir(dir, "loose");

// app/ root: only check immediate subfolders (not loose route files like
// app/page.tsx, app/layout.tsx, app/globals.css — those are the shell itself).
{
  const abs = path.join(ROOT, "app");
  for (const child of fs.readdirSync(abs, { withFileTypes: true })) {
    if (!child.isDirectory()) continue;
    if (child.name === "admin" || child.name === "api") continue; // handled above
    const rel = `app/${child.name}`;
    if (!allEntries.has(rel)) missing.push(rel);
  }
}

for (const [entry, buckets] of Object.entries(seenIn)) {
  if (buckets.length > 1) duplicates.push(`${entry} -> [${buckets.join(", ")}]`);
}

if (missing.length === 0 && duplicates.length === 0) {
  console.log(`OK — every folder/file is classified in exactly one tier bucket.`);
  process.exit(0);
}

if (missing.length > 0) {
  console.error(`\nUnmapped (not in any tier bucket) — ${missing.length}:`);
  for (const m of missing) console.error(`  - ${m}`);
}
if (duplicates.length > 0) {
  console.error(`\nDuplicate (in more than one tier bucket) — ${duplicates.length}:`);
  for (const d of duplicates) console.error(`  - ${d}`);
}
process.exit(1);
