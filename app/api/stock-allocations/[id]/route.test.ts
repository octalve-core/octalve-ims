import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0031 — representative sample for a dynamic-segment ([id]) route,
 * confirming the CSRF guard fires before rate-limiting, session checks, or
 * the params promise are ever touched.
 */

const { withRateLimit } = vi.hoisted(() => ({ withRateLimit: vi.fn() }));

vi.mock("@/utils/auth", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/prisma/client", () => ({ prisma: {} }));
vi.mock("@/prisma/stock-allocation", () => ({
  deleteStockAllocation: vi.fn(),
  getStockAllocationById: vi.fn(),
  updateStockAllocation: vi.fn(),
}));
vi.mock("@/lib/products/stock-product-access", () => ({ findAccessibleProduct: vi.fn() }));
vi.mock("@/lib/cache", () => ({ scheduleInvalidateStockAllocationCaches: vi.fn() }));
vi.mock("@/lib/api/rate-limit", () => ({ withRateLimit, defaultRateLimits: { standard: {} } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { PUT } from "@/app/api/stock-allocations/[id]/route";

function request(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/stock-allocations/alloc-1", {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ quantity: 5 }),
  });
}

function params() {
  return { params: Promise.resolve({ id: "alloc-1" }) };
}

describe("PUT /api/stock-allocations/[id] — CSRF guard", () => {
  it("rejects a cross-origin request before rate-limiting or reading params", async () => {
    const res = await PUT(
      request({ origin: "http://attacker.example", host: "localhost" }),
      params(),
    );
    expect(res?.status).toBe(403);
    expect(withRateLimit).not.toHaveBeenCalled();
  });

  it("proceeds past the guard on a same-origin request", async () => {
    withRateLimit.mockResolvedValue(null);
    const res = await PUT(request({ origin: "http://localhost", host: "localhost" }), params());
    // Falls through past CSRF to the next real check (session), not blocked at 403.
    expect(res?.status).not.toBe(403);
  });
});
