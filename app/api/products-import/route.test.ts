import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Found while fixing ISS-0086 in this same route: the import's own "Failed: N" summary (and
 * the "close the dialog automatically after 2s" behavior gated on failedRows === 0 in
 * ProductImportDialog.tsx) undercounts failures. `failCount` starts at 0 and only increments
 * inside the loop over validationResult.validRows — rows that fail Zod schema validation
 * itself (blank name, negative price, …) land only in `errors` (seeded from
 * validationResult.errors), never touching failCount. A real run with 2 schema-invalid rows
 * among 8 reported successRows: 6, failedRows: 0 — so the dialog showed no "Failed" line at
 * all and silently closed itself 2 seconds later, even though 2 rows demonstrably failed and
 * their errors were right there in the response.
 */

const {
  getSessionFromRequest,
  withRateLimit,
  prismaMock,
  checkAndSendStockAlerts,
} = vi.hoisted(() => {
  const category = { findMany: vi.fn() };
  const supplier = { findMany: vi.fn() };
  const product = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const user = { findUnique: vi.fn() };
  const importHistory = { create: vi.fn(), update: vi.fn() };
  return {
    getSessionFromRequest: vi.fn(),
    withRateLimit: vi.fn(),
    checkAndSendStockAlerts: vi.fn(),
    prismaMock: { category, supplier, product, user, importHistory },
  };
});

vi.mock("@/utils/auth", () => ({ getSessionFromRequest }));
vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit,
  defaultRateLimits: { standard: {} },
}));
vi.mock("@/prisma/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email/notifications", () => ({ checkAndSendStockAlerts }));
vi.mock("@/lib/cache", () => ({ scheduleInvalidateImportCaches: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { POST } from "./route";

const CSV = [
  "Product Name,SKU,Price,Quantity,Status,Category,Supplier",
  "Ginger Beer 330ml,GIN-330,250.00,80,Available,Beverages,Lagos Fresh Foods",
  "Plantain Chips 100g,PLC-100,150.00,120,Available,Snacks,Lagos Fresh Foods",
  ",MISSING-NAME,100.00,10,Available,Beverages,Lagos Fresh Foods",
  "Bad Price Item,BAD-PRICE,-50.00,10,Available,Snacks,Lagos Fresh Foods",
].join("\n");

function request(): NextRequest {
  const formData = new FormData();
  formData.append(
    "file",
    new File([CSV], "products-import.csv", { type: "text/csv" }),
  );
  return new NextRequest("http://localhost/api/products-import", {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost" },
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  withRateLimit.mockResolvedValue(null);
  getSessionFromRequest.mockResolvedValue({ id: "u1", role: "admin" });
  prismaMock.importHistory.create.mockResolvedValue({ id: "ih1" });
  prismaMock.importHistory.update.mockResolvedValue({});
  prismaMock.category.findMany.mockResolvedValue([{ id: "cat-bev", name: "Beverages" }]);
  prismaMock.supplier.findMany.mockResolvedValue([{ id: "sup-lff", name: "Lagos Fresh Foods" }]);
  // Snacks deliberately absent from category.findMany, matching this fixture's real bug
  // reproduction less — kept simple here: every row that reaches product creation succeeds.
  prismaMock.product.findUnique.mockResolvedValue(null);
  prismaMock.product.create.mockResolvedValue({});
  prismaMock.product.findMany.mockResolvedValue([]);
  prismaMock.user.findUnique.mockResolvedValue({
    email: "owner@example.com",
    name: "Owner Name",
  });
  checkAndSendStockAlerts.mockResolvedValue(undefined);
});

describe("POST /api/products-import — failedRows must count every real failure", () => {
  it("counts rows that fail Zod validation (blank name, negative price) as failed, not silently", async () => {
    prismaMock.category.findMany.mockResolvedValue([
      { id: "cat-bev", name: "Beverages" },
      { id: "cat-snacks", name: "Snacks" },
    ]);

    const res = await POST(request());
    const body = await res.json();

    expect(body.totalRows).toBe(4);
    expect(body.successRows).toBe(2);
    // The bug: this used to be 0 even though 2 rows demonstrably failed.
    expect(body.failedRows).toBe(2);
    expect(body.successRows + body.failedRows).toBe(body.totalRows);
    expect(body.errors).toHaveLength(2);
    expect(body.errors.some((e: { message: string }) => /name/i.test(e.message))).toBe(true);
    expect(body.errors.some((e: { message: string }) => /negative/i.test(e.message))).toBe(true);
  });

  it("still counts a post-validation failure (category not found) alongside a schema failure", async () => {
    // Snacks absent here — Plantain Chips (row 2) now ALSO fails, for a real,
    // post-validation reason, on top of the two schema-invalid rows.
    const res = await POST(request());
    const body = await res.json();

    expect(body.totalRows).toBe(4);
    expect(body.successRows).toBe(1);
    expect(body.failedRows).toBe(3);
    expect(body.successRows + body.failedRows).toBe(body.totalRows);
  });
});

describe("POST /api/products-import — stock-alert fan-out (ISS-0039)", () => {
  it("passes recipientEmail/recipientName/userId in their real positional slots, not shifted", async () => {
    prismaMock.category.findMany.mockResolvedValue([
      { id: "cat-bev", name: "Beverages" },
      { id: "cat-snacks", name: "Snacks" },
    ]);

    await POST(request());

    expect(checkAndSendStockAlerts).toHaveBeenCalled();
    for (const call of checkAndSendStockAlerts.mock.calls) {
      const [, previousQuantity, recipientEmail, recipientName, userId] = call;
      expect(previousQuantity).toBeUndefined();
      expect(recipientEmail).toBe("owner@example.com");
      expect(recipientName).toBe("Owner Name");
      expect(userId).toBe("u1");
    }
  });

  it("only alerts on rows this import actually created, not the user's whole catalog", async () => {
    prismaMock.category.findMany.mockResolvedValue([
      { id: "cat-bev", name: "Beverages" },
      { id: "cat-snacks", name: "Snacks" },
    ]);

    await POST(request());

    // Fixture has 2 rows that successfully create (Ginger Beer, Plantain Chips);
    // the other 2 fail validation before any create happens.
    expect(checkAndSendStockAlerts).toHaveBeenCalledTimes(2);
    const names = checkAndSendStockAlerts.mock.calls.map((call) => call[0].name);
    expect(names).toEqual(["Ginger Beer 330ml", "Plantain Chips 100g"]);
    // The old bug queried the user's entire catalog for this — assert it's gone.
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
  });
});
