import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashExportFileListing, writeRunManifest, type RunManifest } from "./run-manifest";

const scratchDirs: string[] = [];

function makeScratchDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "walkthrough-run-manifest-test-"));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (scratchDirs.length > 0) {
    fs.rmSync(scratchDirs.pop()!, { recursive: true, force: true });
  }
});

describe("hashExportFileListing", () => {
  it("is stable for the same set of files regardless of creation order", () => {
    const dirA = makeScratchDir();
    fs.writeFileSync(path.join(dirA, "a.txt"), "1");
    fs.mkdirSync(path.join(dirA, "sub"));
    fs.writeFileSync(path.join(dirA, "sub", "b.txt"), "2");

    const dirB = makeScratchDir();
    fs.mkdirSync(path.join(dirB, "sub"));
    fs.writeFileSync(path.join(dirB, "sub", "b.txt"), "2");
    fs.writeFileSync(path.join(dirB, "a.txt"), "1");

    expect(hashExportFileListing(dirA)).toBe(hashExportFileListing(dirB));
  });

  it("changes when a file is added", () => {
    const dir = makeScratchDir();
    fs.writeFileSync(path.join(dir, "a.txt"), "1");
    const before = hashExportFileListing(dir);

    fs.writeFileSync(path.join(dir, "b.txt"), "2");
    const after = hashExportFileListing(dir);

    expect(after).not.toBe(before);
  });

  it("ignores node_modules and .next", () => {
    const dir = makeScratchDir();
    fs.writeFileSync(path.join(dir, "a.txt"), "1");
    const before = hashExportFileListing(dir);

    fs.mkdirSync(path.join(dir, "node_modules", "x"), { recursive: true });
    fs.writeFileSync(path.join(dir, "node_modules", "x", "index.js"), "noise");
    fs.mkdirSync(path.join(dir, ".next"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".next", "build-id"), "noise");

    expect(hashExportFileListing(dir)).toBe(before);
  });
});

describe("writeRunManifest", () => {
  it("writes the manifest as formatted JSON, creating the output directory", () => {
    const dir = makeScratchDir();
    const outFile = path.join(dir, "nested", "run-manifest.json");
    const manifest: RunManifest = {
      tier: "premium",
      commitSha: "abc123",
      databaseHost: "127.0.0.1:5432",
      databaseName: "octalve_ims_test",
      baseUrl: "http://localhost:3100",
      exportDirFileListingHash: "deadbeef",
      startedAt: "2026-10-23T00:00:00.000Z",
      finishedAt: "2026-10-23T00:10:00.000Z",
    };

    writeRunManifest(outFile, manifest);

    const written = JSON.parse(fs.readFileSync(outFile, "utf8"));
    expect(written).toEqual(manifest);
  });
});
