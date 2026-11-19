import { describe, expect, it } from "vitest";
import { applyMigrationsAndRls, flushRedisTestDb, recreateDatabase } from "./stage";

/**
 * Only the name/index guards are exercised here, deliberately: they throw
 * before ever opening a connection, so they're safe to run in any
 * environment. The destructive paths these guards protect (drop/recreate
 * the database, flush the Redis db) are exactly what the real pipeline run
 * is supposed to do to the walkthrough's own dedicated database — proving
 * those paths work is part of that run, not this unit test file.
 */

describe("recreateDatabase", () => {
  it("refuses any database name but octalve_ims_test, without connecting", async () => {
    await expect(recreateDatabase("postgresql://roji:roji@127.0.0.1:5432/some_other_db")).rejects.toThrow(
      /refuses to touch database/,
    );
  });
});

describe("applyMigrationsAndRls", () => {
  it("refuses any database name but octalve_ims_test, without shelling out", () => {
    expect(() =>
      applyMigrationsAndRls("/tmp/not-a-real-export", "postgresql://roji:roji@127.0.0.1:5432/wrong_db"),
    ).toThrow(/refuses to touch database/);
  });
});

describe("flushRedisTestDb", () => {
  it("refuses any logical database but 15, without connecting", async () => {
    await expect(flushRedisTestDb("redis://localhost:6379/0")).rejects.toThrow(
      /refuses to flush Redis logical database/,
    );
  });
});
