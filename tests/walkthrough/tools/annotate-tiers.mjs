#!/usr/bin/env node
/**
 * Phase 0b — annotates coverage.yaml with a `tiers:` field per row by
 * cross-referencing each row's file (page/api kind) against the three
 * tier inventories, then generates coverage.<tier>.yaml filtered to rows
 * whose tiers include that tier. Non-file rows (feature/validation/
 * empty-state/negative/not-demonstrable) inherit tiers from the storyboard
 * steps they cite (storyboard.md's own step->page/api mapping), per
 * per-package-plan.md step 3.
 *
 * Usage: node annotate-tiers.mjs <coverage.yaml> <inventory.premium.json> <inventory.core.json> <inventory.pro.json> <storyboard.md> <outDir>
 */
import fs from "node:fs";
import yaml from "yaml";

const [covPath, premPath, corePath, proPath, storyboardPath, outDir] = process.argv.slice(2);

const coverage = yaml.parse(fs.readFileSync(covPath, "utf8"));
const inv = {
  premium: JSON.parse(fs.readFileSync(premPath, "utf8")),
  core: JSON.parse(fs.readFileSync(corePath, "utf8")),
  pro: JSON.parse(fs.readFileSync(proPath, "utf8")),
};

const fileSets = {};
for (const tier of ["premium", "core", "pro"]) {
  const s = new Set();
  for (const p of inv[tier].pages) s.add(p.file);
  for (const a of inv[tier].api) s.add(a.file);
  fileSets[tier] = s;
}

function tiersForFile(file) {
  return ["core", "pro", "premium"].filter((t) => fileSets[t].has(file));
}

function extractFile(ref) {
  // "app/foo/page.tsx -> /foo" or "app/api/foo/route.ts -> GET /api/foo"
  const m = /^([^\s]+\.tsx?)\s*->/.exec(ref);
  return m ? m[1] : null;
}

// Build step -> tiers from storyboard: a step's tiers are the union of the
// tiers of every page/api row whose `steps` field cites it.
const stepTiers = new Map();
function addStepTiers(stepsField, tiers) {
  if (!stepsField) return;
  for (const id of String(stepsField).split(",").map((s) => s.trim()).filter(Boolean)) {
    const existing = stepTiers.get(id) || new Set();
    for (const t of tiers) existing.add(t);
    stepTiers.set(id, existing);
  }
}

const fileBackedKinds = new Set(["page", "api"]);
for (const row of coverage.rows) {
  if (fileBackedKinds.has(row.kind)) {
    const file = extractFile(row.ref);
    const tiers = file ? tiersForFile(file) : ["core", "pro", "premium"];
    row._fileTiers = tiers;
    addStepTiers(row.steps, tiers);
  }
}

// Second pass: assign tiers to every row.
const unresolved = [];
for (const row of coverage.rows) {
  if (row._fileTiers) {
    row.tiers = row._fileTiers;
    delete row._fileTiers;
    continue;
  }
  // Non-file row: union of its cited steps' tiers.
  const ids = row.steps ? String(row.steps).split(",").map((s) => s.trim()).filter(Boolean) : [];
  const union = new Set();
  for (const id of ids) {
    const t = stepTiers.get(id);
    if (t) for (const x of t) union.add(x);
  }
  if (union.size > 0) {
    row.tiers = ["core", "pro", "premium"].filter((t) => union.has(t));
  } else {
    // No file, no resolvable step (e.g. a not-demonstrable external-service
    // row, or a feature row citing only docs/user-flows-and-stories.md with
    // no module step yet) — applies to all tiers by default; flagged for review.
    row.tiers = ["core", "pro", "premium"];
    unresolved.push(row.id);
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  `${outDir}/coverage.yaml`,
  "# Phase 0b — coverage.yaml annotated with a tiers: field per row (generated; see tools/annotate-tiers.mjs).\n" +
    yaml.stringify(coverage),
);

for (const tier of ["core", "pro", "premium"]) {
  const filtered = {
    meta: { ...coverage.meta, scope: tier.toUpperCase(), generated_from: [...coverage.meta.generated_from, "tools/annotate-tiers.mjs"] },
    rows: coverage.rows.filter((r) => r.tiers.includes(tier)).map((r) => {
      const { tiers, ...rest } = r;
      return rest;
    }),
  };
  fs.writeFileSync(`${outDir}/coverage.${tier}.yaml`, yaml.stringify(filtered));
  console.log(`${tier}: ${filtered.rows.length} rows`);
}

console.log(`unresolved (defaulted to all tiers): ${unresolved.length}`, unresolved.slice(0, 20));
