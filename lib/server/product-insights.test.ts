import { describe, expect, it } from "vitest";
import { computeProductInsights } from "@/lib/server/product-insights";

describe("computeProductInsights", () => {
  it("derives single-product stock status and sales trend", () => {
    const insights = computeProductInsights(100, [
      {
        quantity: 10,
        subtotal: 50,
        orderId: "o1",
        order: {
          createdAt: new Date("2026-01-15"),
          subtotal: 50,
          total: 55,
          status: "delivered",
          paymentStatus: "paid",
        },
      },
    ]);

    expect(insights.stockBreakdown.available).toBe(1);
    expect(insights.warehouseStock).toBeUndefined();
    expect(insights.salesTrend.length).toBeGreaterThanOrEqual(1);
  });

  it("REQ-0140 — excludes pending from sold; stock uses committed available", () => {
    const insights = computeProductInsights(
      50,
      [
        {
          quantity: 20,
          subtotal: 3980,
          orderId: "o2",
          order: {
            createdAt: new Date("2026-07-15"),
            subtotal: 3980,
            total: 3980,
            status: "pending",
            paymentStatus: "unpaid",
          },
        },
      ],
      20,
    );
    expect(insights.demandVelocity).toBe(0);
    expect(insights.salesTrend).toEqual([]);
    // available qty = 50 − 20 = 30 → available bucket
    expect(insights.stockBreakdown.available).toBe(1);
    expect(insights.lowStockCount).toBe(0);
  });
});
