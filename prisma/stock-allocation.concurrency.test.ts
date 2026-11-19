import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import { completeStockTransfer } from "./stock-allocation";

/**
 * ISS-0043 — proves the atomic claim actually closes the double-completion
 * race, against a real Postgres connection. completeStockTransfer used to be
 * 4+ separate statements behind a plain `status !== "pending"` read-then-
 * write guard; two concurrent completions of the same transfer both passed
 * that stale check and both applied the stock movement.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "completeStockTransfer, real DB (ISS-0043)",
  () => {
    const stamp = Date.now();
    let categoryId: string;
    let productId: string;
    let fromWarehouseId: string;
    let toWarehouseId: string;
    let transferId: string;

    beforeAll(async () => {
      const category = await prisma.category.create({
        data: {
          name: `ISS-0043 test category ${stamp}`,
          userId: "test-user",
          createdBy: "test-user",
        },
      });
      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          name: "ISS-0043 test product",
          price: 10,
          quantity: 100,
          sku: `iss-0043-${stamp}`,
          status: "active",
          userId: "test-user",
          createdBy: "test-user",
          categoryId,
          supplierId: "test-supplier",
        },
      });
      productId = product.id;

      const fromWarehouse = await prisma.warehouse.create({
        data: {
          name: `ISS-0043 from ${stamp}`,
          userId: "test-user",
          createdBy: "test-user",
        },
      });
      fromWarehouseId = fromWarehouse.id;

      const toWarehouse = await prisma.warehouse.create({
        data: {
          name: `ISS-0043 to ${stamp}`,
          userId: "test-user",
          createdBy: "test-user",
        },
      });
      toWarehouseId = toWarehouse.id;

      await prisma.stockAllocation.create({
        data: {
          productId,
          warehouseId: fromWarehouseId,
          quantity: 50,
          userId: "test-user",
        },
      });

      const transfer = await prisma.stockTransfer.create({
        data: {
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity: 20,
          status: "pending",
          userId: "test-user",
        },
      });
      transferId = transfer.id;
    });

    afterAll(async () => {
      await prisma.stockTransfer.deleteMany({ where: { productId } });
      await prisma.stockAllocation.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
      await prisma.category.delete({ where: { id: categoryId } });
      await prisma.warehouse.delete({ where: { id: fromWarehouseId } });
      await prisma.warehouse.delete({ where: { id: toWarehouseId } });
    });

    it("only lets one of two concurrent completions move stock (Failure: double source-decrement/dest-credit)", async () => {
      const [a, b] = await Promise.allSettled([
        completeStockTransfer(transferId, "test-user"),
        completeStockTransfer(transferId, "test-user"),
      ]);

      const outcomes = [a, b];
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);

      const sourceAllocation = await prisma.stockAllocation.findUniqueOrThrow({
        where: { productId_warehouseId: { productId, warehouseId: fromWarehouseId } },
      });
      expect(Number(sourceAllocation.quantity)).toBe(30); // 50 - 20, exactly once

      const destAllocation = await prisma.stockAllocation.findUniqueOrThrow({
        where: { productId_warehouseId: { productId, warehouseId: toWarehouseId } },
      });
      expect(Number(destAllocation.quantity)).toBe(20); // credited exactly once

      const transfer = await prisma.stockTransfer.findUniqueOrThrow({
        where: { id: transferId },
      });
      expect(transfer.status).toBe("completed");
    });
  },
);
