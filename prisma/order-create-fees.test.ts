import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./client";
import { createOrder } from "./order";
import { getOrderFeesFromSubtotal } from "@/lib/orders/order-fees";
import type { CreateOrderInput } from "@/types/order";

/**
 * ISS-0016 — createOrder used to trust `data.tax`/`data.shipping`/
 * `data.discount` straight from the request body; a buyer calling the API
 * directly (bypassing the form's own fee computation) could submit an
 * arbitrary discount and drive the total to zero or negative. These prove
 * the server now derives fees itself from the trusted subtotal regardless
 * of what a caller submits.
 */
describe.skipIf(!process.env.DATABASE_URL)("createOrder fee trust boundary (ISS-0016)", () => {
  const stamp = Date.now();
  let categoryId: string;
  let productId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `ISS-0016 test category ${stamp}`,
        userId: "test-user",
        createdBy: "test-user",
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: "ISS-0016 test product",
        price: 50,
        quantity: 100,
        sku: `iss-0016-${stamp}`,
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
    await prisma.stockAllocation.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  it("ignores a malicious discount submitted directly to createOrder and computes it from subtotal instead", async () => {
    // Simulates a caller hitting the API directly with a payload the Zod
    // schema and TS type no longer accept — proving the server-side
    // function itself doesn't trust these fields even if something upstream did.
    const maliciousData = {
      items: [{ productId, quantity: 2 }],
      discount: 999999,
      tax: -1,
      shipping: -1,
    } as unknown as CreateOrderInput;

    const order = await createOrder(maliciousData, {
      storeOwnerUserId: "test-user",
      createdByUserId: "test-user",
      clientId: null,
    });
    orderIds.push(order.id);

    const subtotal = 100; // 2 * 50
    const expectedFees = getOrderFeesFromSubtotal(subtotal);
    const expectedTotal =
      subtotal + expectedFees.taxAmount + expectedFees.shippingAmount - expectedFees.discountAmount;

    expect(Number(order.total)).toBeCloseTo(expectedTotal, 5);
    expect(Number(order.total)).toBeGreaterThan(0);
    expect(Number(order.discount)).toBeCloseTo(expectedFees.discountAmount, 5);
  });
});
