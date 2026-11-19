import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import { decrementStockAllocations, restoreStockAllocations } from "./decrement-stock-allocations";

/**
 * ISS-0044(a) — real-DB proof that a no-pick decrement's total units taken
 * from StockAllocation rows comes back in full on restore. Before this fix,
 * cancelling a confirmed no-pick order restored Product.quantity (the
 * catalog total) but never called anything that touched StockAllocation at
 * all — the greedy decrement this mirrors was the only side ever applied,
 * so the per-warehouse total silently drifted below the catalog total on
 * every such cancel. restoreStockAllocations is explicitly best-effort (no
 * record of exactly which row absorbed the original decrement), so this
 * test checks the invariant that actually matters: the SUM across a
 * product's allocation rows returns to what it was before the decrement,
 * not that the same specific row gets the exact units back.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "decrementStockAllocations / restoreStockAllocations, real DB (ISS-0044a)",
  () => {
    const stamp = Date.now();
    let categoryId: string;
    let productId: string;
    let warehouseAId: string;
    let warehouseBId: string;

    beforeAll(async () => {
      const category = await prisma.category.create({
        data: {
          name: `ISS-0044a test category ${stamp}`,
          userId: "test-user",
          createdBy: "test-user",
        },
      });
      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          name: "ISS-0044a test product",
          price: 10,
          quantity: 40,
          sku: `iss-0044a-${stamp}`,
          status: "active",
          userId: "test-user",
          createdBy: "test-user",
          categoryId,
          supplierId: "test-supplier",
        },
      });
      productId = product.id;

      const warehouseA = await prisma.warehouse.create({
        data: { name: `ISS-0044a A ${stamp}`, userId: "test-user", createdBy: "test-user" },
      });
      warehouseAId = warehouseA.id;
      const warehouseB = await prisma.warehouse.create({
        data: { name: `ISS-0044a B ${stamp}`, userId: "test-user", createdBy: "test-user" },
      });
      warehouseBId = warehouseB.id;

      await prisma.stockAllocation.create({
        data: { productId, warehouseId: warehouseAId, quantity: 30, userId: "test-user" },
      });
      await prisma.stockAllocation.create({
        data: { productId, warehouseId: warehouseBId, quantity: 10, userId: "test-user" },
      });
    });

    afterAll(async () => {
      await prisma.stockAllocation.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
      await prisma.category.delete({ where: { id: categoryId } });
      await prisma.warehouse.delete({ where: { id: warehouseAId } });
      await prisma.warehouse.delete({ where: { id: warehouseBId } });
    });

    const totalAllocated = async () => {
      const rows = await prisma.stockAllocation.findMany({ where: { productId } });
      return rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    };

    it("restores the full decremented total across allocations, even without pick-level precision", async () => {
      expect(await totalAllocated()).toBe(40);

      await decrementStockAllocations([{ productId, quantity: 15 }]);
      // Greedy decrement takes from the largest-available first (A: 30 -> 15).
      expect(await totalAllocated()).toBe(25);

      await restoreStockAllocations([{ productId, quantity: 15 }]);
      expect(await totalAllocated()).toBe(40);
    });

    it("is a no-op for warehouse-pick items (those restore via the exact allocation path instead)", async () => {
      const before = await totalAllocated();
      await restoreStockAllocations([{ productId, quantity: 999, warehouseId: warehouseAId }]);
      expect(await totalAllocated()).toBe(before);
    });
  },
);
