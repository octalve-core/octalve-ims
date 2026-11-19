import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0034 — MAX_AUDIT_LOGS used to be 50, a global cap so small the audit
 * trail rolled over within hours on any real deployment. This pins the raised
 * ceiling (10,000) and confirms the FIFO trim still fires once something
 * actually exceeds it.
 */

const { create, count, findMany, deleteMany } = vi.hoisted(() => ({
  create: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/prisma/client", () => ({
  prisma: {
    auditLog: { create, count, findMany, deleteMany },
  },
}));

import { createAuditLog } from "./audit-log";

const baseInput = {
  userId: "u1",
  action: "create" as const,
  entityType: "product" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: "log1", ...baseInput, createdAt: new Date() });
});

describe("createAuditLog retention", () => {
  it("does not trim at 60 total rows (old 50-row cap would have)", async () => {
    count.mockResolvedValue(60);
    await createAuditLog(baseInput);
    expect(findMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("still trims the oldest rows once the count exceeds the raised ceiling", async () => {
    count.mockResolvedValue(10_005);
    findMany.mockResolvedValue([{ id: "old1" }, { id: "old2" }]);
    await createAuditLog(baseInput);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, orderBy: { createdAt: "asc" } }),
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["old1", "old2"] } },
    });
  });
});
