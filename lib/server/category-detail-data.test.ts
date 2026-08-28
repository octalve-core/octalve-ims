import { describe, expect, it } from "vitest";
import {
  computeCatalogInsights,
  CATALOG_LOW_STOCK_THRESHOLD,
} from "@/lib/server/catalog-insights";

describe("computeCatalogInsights", () => {
  it("counts low and out of stock products", () => {
    const products = [
      {
        quantity: BigInt(0),
        price: 10,
        orderItems: [],
        userId: "u1",
        supplierId: "s1",
        reservedQuantity: BigInt(0),
      },
      {
        quantity: BigInt(CATALOG_LOW_STOCK_THRESHOLD),
        price: 10,
        orderItems: [],
        userId: "u1",
        supplierId: "s1",
        reservedQuantity: BigInt(0),
      },
      {
        quantity: BigInt(100),
        price: 10,
        orderItems: [],
        userId: "u1",
        supplierId: "s1",
        reservedQuantity: BigInt(0),
      },
    ] as unknown as Parameters<typeof computeCatalogInsights>[0];

    const insights = computeCatalogInsights(products, 200, 2, 50);
    expect(insights.outOfStockCount).toBe(1);
    expect(insights.lowStockCount).toBe(1);
    expect(insights.stockBreakdown.out).toBe(1);
    expect(insights.stockBreakdown.low).toBe(1);
    expect(insights.stockBreakdown.available).toBe(1);
    expect(insights.avgOrderValue).toBe(100);
  });
});
