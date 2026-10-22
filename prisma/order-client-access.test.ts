import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./client";
import { getOrderByIdForClient } from "./order";

/**
 * ISS-0017 — getOrderByIdForClient used to fall back to "any order with at
 * least one line item" whenever the id wasn't the caller's own, so any
 * logged-in client could read any other buyer's full order (shipping
 * address, email, items, total) just by requesting its id. Proves the
 * fallback is gone: a client can only ever read their own order.
 */
describe.skipIf(!process.env.DATABASE_URL)("getOrderByIdForClient (ISS-0017)", () => {
  const stamp = Date.now();
  let categoryId: string;
  let productId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `ISS-0017 test category ${stamp}`,
        userId: "test-user",
        createdBy: "test-user",
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: "ISS-0017 test product",
        price: 10,
        quantity: 100,
        sku: `iss-0017-${stamp}`,
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

  async function createOrderForClient(suffix: string, clientId: string | null) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `ISS-0017-${stamp}-${suffix}`,
        userId: "test-user",
        clientId,
        createdBy: "test-user",
        subtotal: 10,
        total: 10,
        items: {
          create: [
            {
              productId,
              productName: "ISS-0017 test product",
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

  it("returns the order when the caller is its own buyer", async () => {
    const order = await createOrderForClient("own", "client-a");
    const result = await getOrderByIdForClient(order.id, "client-a");
    expect(result?.id).toBe(order.id);
  });

  it("returns null for another buyer's order instead of falling back to any order with items", async () => {
    const order = await createOrderForClient("other-buyer", "client-a");
    const result = await getOrderByIdForClient(order.id, "client-b");
    expect(result).toBeNull();
  });
});
