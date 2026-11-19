import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0026 — delete-all-data.ts, reset-demo-db.ts and prisma/seed.ts wipe
 * every row in whatever DATABASE_URL points to, with no check on what that
 * actually is. This guard must auto-bypass for CI and localhost (the two
 * cases that are genuinely safe), and otherwise force a human to type the
 * target host back before a full wipe proceeds.
 */

const mockQuestion = vi.fn();
const mockClose = vi.fn();

vi.mock("node:readline/promises", () => ({
  default: {
    createInterface: () => ({
      question: mockQuestion,
      close: mockClose,
    }),
  },
}));

describe("confirmDestructiveDbAction (ISS-0026)", () => {
  const originalEnv = { ...process.env };
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    mockQuestion.mockReset();
    mockClose.mockReset();
    process.env = { ...originalEnv };
    delete process.env.CI;
    delete process.env.CONFIRM_DESTRUCTIVE_DB_ACTION;
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    exitSpy.mockRestore();
  });

  it("bypasses the prompt when CI is set", async () => {
    process.env.CI = "true";
    process.env.DATABASE_URL = "postgresql://user:pass@some-host.neon.tech/db";
    const { confirmDestructiveDbAction } = await import(
      "./confirm-destructive-db-action"
    );

    await confirmDestructiveDbAction("delete ALL data");

    expect(mockQuestion).not.toHaveBeenCalled();
  });

  it("bypasses the prompt when CONFIRM_DESTRUCTIVE_DB_ACTION=1", async () => {
    process.env.CONFIRM_DESTRUCTIVE_DB_ACTION = "1";
    process.env.DATABASE_URL = "postgresql://user:pass@some-host.neon.tech/db";
    const { confirmDestructiveDbAction } = await import(
      "./confirm-destructive-db-action"
    );

    await confirmDestructiveDbAction("delete ALL data");

    expect(mockQuestion).not.toHaveBeenCalled();
  });

  it("bypasses the prompt for a localhost target", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    const { confirmDestructiveDbAction } = await import(
      "./confirm-destructive-db-action"
    );

    await confirmDestructiveDbAction("delete ALL data");

    expect(mockQuestion).not.toHaveBeenCalled();
  });

  it("bypasses the prompt for a 127.0.0.1 target", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/db";
    const { confirmDestructiveDbAction } = await import(
      "./confirm-destructive-db-action"
    );

    await confirmDestructiveDbAction("delete ALL data");

    expect(mockQuestion).not.toHaveBeenCalled();
  });

  it("proceeds when a non-local target's confirmation matches the host", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@some-host.neon.tech/db";
    mockQuestion.mockResolvedValue("some-host.neon.tech");
    const { confirmDestructiveDbAction } = await import(
      "./confirm-destructive-db-action"
    );

    await confirmDestructiveDbAction("delete ALL data");

    expect(mockQuestion).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("aborts (exits) when a non-local target's confirmation does not match (Failure: careless wipe of a shared DB)", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@some-host.neon.tech/db";
    mockQuestion.mockResolvedValue("nope");
    const { confirmDestructiveDbAction } = await import(
      "./confirm-destructive-db-action"
    );

    await expect(
      confirmDestructiveDbAction("delete ALL data"),
    ).rejects.toThrow("process.exit(1)");

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
