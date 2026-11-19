import fs from "node:fs";
import path from "node:path";

/**
 * Guards `export-tier.ts`'s `fs.rmSync(outDir, { recursive: true, force: true })`,
 * which wipes whatever `outDir` resolves to. Refuses anything that isn't
 * obviously a disposable export directory (ISS-0061: `export:core .` used
 * to wipe the repo root).
 */
export function assertSafeExportTarget(
  dir: string,
  root: string,
  home: string | null,
): void {
  const forbidden = [path.resolve("/"), root, ...(home ? [home] : [])];
  for (const bad of forbidden) {
    // Refuse if the target IS a protected path, or is an ANCESTOR of one
    // (deleting an ancestor directory deletes everything under it too).
    if (dir === bad || bad.startsWith(dir + path.sep)) {
      throw new Error(
        `export-tier.ts refuses to delete "${dir}" — it is, or contains, the repo root or home directory. Pass a dedicated, disposable output directory.`,
      );
    }
  }
  // Also refuse any ancestor of the repo root itself (deleting it would take root with it).
  if (root.startsWith(dir + path.sep)) {
    throw new Error(
      `export-tier.ts refuses to delete "${dir}" — it is an ancestor of the repo root (${root}). Pass a dedicated, disposable output directory.`,
    );
  }
  if (
    fs.existsSync(dir) &&
    (fs.existsSync(path.join(dir, "package.json")) ||
      fs.existsSync(path.join(dir, ".git")))
  ) {
    throw new Error(
      `export-tier.ts refuses to delete "${dir}" — it already contains a package.json or .git, which looks like a real project, not a disposable export output. Remove it yourself first if that's intended.`,
    );
  }
}
