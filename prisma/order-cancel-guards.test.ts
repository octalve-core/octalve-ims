import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./client";
import { cancelOrder } from "./order";

/**
 * ISS-0011 — real-DB tests for cancelOrder's two new guards: rejecting a
 * cancel on a delivered order (its goods are already with the customer,
 * not back in the warehouse — restoring stock for it would be wrong),
 * and treating an already-cancelled order as an idempotent no-op rather
 * than reprocessing refund/stock logic a second time.
 */
describe.skipIf(!process.env.DATABASE_URL)("cancelOrder guards (ISS-0011)", () => {
  const stamp = Date.now();
  let categoryId: string;
  let productId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `ISS-0011 test category ${stamp}`,
        userId: "test-user",
        createdBy: "test-user",
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: "ISS-0011 test product",
        price: 10,
        quantity: 100,
        sku: `iss-0011-${stamp}`,
        status: "active",
        userId: "test-user",
        createdBy: "test-user",
        categoryId,
        supplierId: "test-supplier",
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  async function createOrderWithStatus(suffix: string, status: string) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `ISS-0011-${stamp}-${suffix}`,
        userId: "test-user",
        createdBy: "test-user",
        subtotal: 10,
        total: 10,
        status,
        paymentStatus: "paid",
        items: {
          create: [
            {
              productId,
              productName: "ISS-0011 test product",
              quantity: 1,
              price: 10,
              subtotal: 10,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);
    return order;
  }

  it("rejects cancelling a delivered order instead of restoring stock as if returned", async () => {
    const order = await createOrderWithStatus("delivered", "delivered");
    const before = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

    await expect(cancelOrder(order.id, "test-user")).rejects.toThrow(
      /Cannot cancel a delivered order/,
    );

    const after = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    // Stock untouched — no false "return" credited.
    expect(Number(after.quantity)).toBe(Number(before.quantity));

    const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.status).toBe("delivered");
  });

  it("treats cancelling an already-cancelled order as an idempotent no-op", async () => {
    const order = await createOrderWithStatus("already-cancelled", "cancelled");
    const before = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

    const result = await cancelOrder(order.id, "test-user");
    expect(result.status).toBe("cancelled");

    const after = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    // No double stock-restore from reprocessing an already-cancelled order.
    expect(Number(after.quantity)).toBe(Number(before.quantity));
  });
});
