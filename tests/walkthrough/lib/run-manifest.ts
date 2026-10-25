import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Ties one run's video, PDF, findings and coverage tick-off to one build
 * (per-package-plan.md section 5 step 7): the source commit, the export's
 * exact file listing, and the database/host it ran against. Written once
 * per package run, after the server is stopped.
 */
export type RunManifest = {
  tier: "core" | "pro" | "premium";
  commitSha: string;
  databaseHost: string;
  databaseName: string;
  baseUrl: string;
  exportDirFileListingHash: string;
  startedAt: string;
  finishedAt: string;
};

/** sha256 over the sorted relative file list of an export dir (not file contents — presence/shape only). */
export function hashExportFileListing(exportDir: string): string {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else {
        files.push(path.relative(exportDir, abs));
      }
    }
  };
  walk(exportDir);
  files.sort();
  return crypto.createHash("sha256").update(files.join("\n")).digest("hex");
}

export function writeRunManifest(outFile: string, manifest: RunManifest): void {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));
}
