import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSafeExportTarget } from "./export-tier-guard";

const ROOT = "/repo/ims";
const HOME = "/home/dev";

describe("assertSafeExportTarget (ISS-0061)", () => {
  it("refuses the repo root itself", () => {
    expect(() => assertSafeExportTarget(ROOT, ROOT, HOME)).toThrow(/refuses to delete/);
  });

  it("refuses an ancestor of the repo root", () => {
    expect(() => assertSafeExportTarget("/repo", ROOT, HOME)).toThrow(/refuses to delete/);
  });

  it("refuses the filesystem root", () => {
    expect(() => assertSafeExportTarget("/", ROOT, HOME)).toThrow(/refuses to delete/);
  });

  it("refuses the home directory", () => {
    expect(() => assertSafeExportTarget(HOME, ROOT, HOME)).toThrow(/refuses to delete/);
  });

  it("refuses an ancestor of the home directory", () => {
    expect(() => assertSafeExportTarget("/home", ROOT, HOME)).toThrow(/refuses to delete/);
  });

  describe("with a real disposable directory", () => {
    let scratch: string;

    beforeEach(() => {
      scratch = mkdtempSync(path.join(tmpdir(), "export-tier-guard-test-"));
    });

    afterEach(() => {
      rmSync(scratch, { recursive: true, force: true });
    });

    it("allows a dedicated, empty output directory", () => {
      const outDir = path.join(scratch, "octalve-ims-core");
      expect(() => assertSafeExportTarget(outDir, ROOT, HOME)).not.toThrow();
    });

    it("refuses a directory that already contains a package.json", () => {
      writeFileSync(path.join(scratch, "package.json"), "{}");
      expect(() => assertSafeExportTarget(scratch, ROOT, HOME)).toThrow(
        /looks like a real project/,
      );
    });

    it("refuses a directory that already contains a .git folder", () => {
      writeFileSync(path.join(scratch, ".git"), "");
      expect(() => assertSafeExportTarget(scratch, ROOT, HOME)).toThrow(
        /looks like a real project/,
      );
    });
  });
});
