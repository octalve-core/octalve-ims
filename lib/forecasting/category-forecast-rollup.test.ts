import { describe, expect, it } from "vitest";
import { buildCategoryForecastRollup } from "@/lib/forecasting/category-forecast-rollup";
import type { ProductDemandForecast } from "@/types";

describe("buildCategoryForecastRollup", () => {
  const forecasts: ProductDemandForecast[] = [
    {
      productId: "p1",
      productName: "A",
      sku: "SKU-A",
      imageUrl: "https://example.com/a.jpg",
      categoryId: "c1",
      categoryName: "Cat",
      supplierId: "s1",
      supplierName: "Sup",
      supplierImage: null,
      currentStock: 2,
      availableStock: 1,
      averageDailySales: 2,
      predictedDailySales: 3,
      daysUntilStockout: 1,
      reorderRecommendation: "urgent",
      suggestedReorderQuantity: 10,
      confidenceScore: 80,
    },
    {
      productId: "p2",
      productName: "B",
      sku: "SKU-B",
      currentStock: 10,
      availableStock: 8,
      averageDailySales: 1,
      predictedDailySales: 1.5,
      daysUntilStockout: 5,
      reorderRecommendation: "soon",
      suggestedReorderQuantity: 5,
      confidenceScore: 70,
    },
    {
      productId: "p-other",
      productName: "Other",
      sku: "SKU-O",
      currentStock: 100,
      availableStock: 100,
      averageDailySales: 0,
      predictedDailySales: 0,
      daysUntilStockout: null,
      reorderRecommendation: "normal",
      suggestedReorderQuantity: 0,
      confidenceScore: 50,
    },
  ];

  it("filters forecasts to category product IDs", () => {
    const rollup = buildCategoryForecastRollup(
      forecasts,
      new Set(["p1", "p2"]),
    );
    expect(rollup.urgentReorderCount).toBe(1);
    expect(rollup.soonReorderCount).toBe(1);
    expect(rollup.predictedDailyDemand).toBe(4.5);
    expect(rollup.topUrgent).toHaveLength(1);
    expect(rollup.topUrgent[0]?.productId).toBe("p1");
    expect(rollup.topUrgent[0]?.imageUrl).toBe("https://example.com/a.jpg");
    expect(rollup.topUrgent[0]?.categoryName).toBe("Cat");
    expect(rollup.topUrgent[0]?.supplierName).toBe("Sup");
  });
});
