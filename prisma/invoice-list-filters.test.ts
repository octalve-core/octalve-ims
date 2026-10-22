/**
 * ISS-0020 — applyInvoiceFiltersToWhere used to let `filters.orderId`/
 * `filters.clientId` (raw request query params) overwrite the caller's own
 * authorization-scoping base fields. getInvoicesByClientId's base pins
 * `clientId` to the caller's own id; getInvoicesByOrderIds' base pins
 * `orderId` to the caller's own authorized order-id set. These prove a
 * query-string filter can no longer replace either.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/prisma/client", () => ({
  prisma: {
    invoice: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { prisma } from "@/prisma/client";
import { getInvoicesByClientId, getInvoicesByOrderIds } from "./invoice";

describe("getInvoicesByClientId (ISS-0020)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignores a clientId filter that differs from the caller's own scope", async () => {
    await getInvoicesByClientId("client-a", { clientId: "client-b" });

    const where = vi.mocked(prisma.invoice.findMany).mock.calls[0][0]!.where!;
    expect(where.clientId).toBe("client-a");
  });

  it("still applies non-conflicting filters (status) alongside the base scope", async () => {
    await getInvoicesByClientId("client-a", { status: ["sent"] });

    const where = vi.mocked(prisma.invoice.findMany).mock.calls[0][0]!.where!;
    expect(where.clientId).toBe("client-a");
    expect(where.status).toEqual({ in: ["sent"] });
  });
});

describe("getInvoicesByOrderIds (ISS-0020)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignores an orderId filter that would replace the caller's authorized order-id set", async () => {
    await getInvoicesByOrderIds(["own-order-1", "own-order-2"], {
      orderId: "someone-elses-order",
    });

    const where = vi.mocked(prisma.invoice.findMany).mock.calls[0][0]!.where!;
    expect(where.orderId).toEqual({ in: ["own-order-1", "own-order-2"] });
  });
});
