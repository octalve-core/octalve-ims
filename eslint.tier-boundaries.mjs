// Generates import/no-restricted-paths "zones" from tier-manifest.json, so
// the manifest stays the single source of truth for tier boundaries instead
// of being duplicated by hand into lint config. See tier-manifest.json and
// out/../plans (Milestone 0) for the packaging rationale.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import importPlugin from "eslint-plugin-import";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "tier-manifest.json"), "utf8")
);

// Manifest entries are folders (e.g. "lib/orders") or specific loose files
// (e.g. "lib/utils.ts"). no-restricted-paths zone "target"/"from" accept
// glob-ish basePath strings; a bare folder entry works directly, a file
// entry is used as-is too (matched by prefix).
const shared = manifest.shared ?? [];
const core = manifest.core ?? [];
const pro = manifest.pro ?? [];
const premium = manifest.premium ?? [];

const zones = [
  // shared must never import UP into a business tier
  { target: shared, from: [...core, ...pro, ...premium] },
  // core must never import PRO/PREMIUM-only code
  { target: core, from: [...pro, ...premium] },
  // pro must never import PREMIUM-only code
  { target: pro, from: premium },
];

export default [
  {
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: { project: path.join(__dirname, "tsconfig.json") },
      },
    },
    rules: {
      // "warn", not "error": a full-repo run surfaces ~266 pre-existing
      // cross-tier imports inherited from the fork baseline (e.g. Core order/product
      // detail pages importing Pro's Stripe reconciliation or Premium's
      // forecasting/insights enrichment inline). That's real business-logic
      // entanglement predating this fork, not something introduced here —
      // fixing it means splitting each entangled feature properly as its
      // own tier-rollout work, not a Milestone 0 rewrite. Keep this at
      // "warn" so it stays visible and new violations are easy to spot,
      // without hard-failing CI on inherited debt. Ratchet to "error" once
      // a given area's entanglement has actually been resolved.
      "import/no-restricted-paths": ["warn", { zones }],
    },
  },
];
