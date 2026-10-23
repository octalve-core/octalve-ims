import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import { syncOrderPaymentStatusFromInvoice } from "./order-payment-sync";

/**
 * ISS-0010 — proves the atomic pending→confirmed claim actually closes the
 * double-fulfilment race, against a real Postgres connection (a mocked
 * Prisma client can't exercise "two concurrent UPDATEs serialize on the row
 * lock"). This function is reachable concurrently from the Stripe webhook,
 * the checkout return page, confirm-session, and even a plain order-detail
 * GET (its loader heals stuck invoices), so a real race is plausible.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "syncOrderPaymentStatusFromInvoice, real DB (ISS-0010)",
  () => {
    const stamp = Date.now();
    let categoryId: string;
    let productId: string;
    const orderIds: string[] = [];

    beforeAll(async () => {
      const category = await prisma.category.create({
        data: {
          name: `ISS-0010 test category ${stamp}`,
          userId: "test-user",
          createdBy: "test-user",
        },
      });
      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          name: "ISS-0010 test product",
          price: 10,
          quantity: 100,
          reservedQuantity: 1,
          sku: `iss-0010-${stamp}`,
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

    it("only lets one of two concurrent syncs fulfil a pending order (Failure: double-decremented stock)", async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: `ISS-0010-${stamp}-concurrent`,
          userId: "test-user",
          createdBy: "test-user",
          subtotal: 10,
          total: 10,
          status: "pending",
          paymentStatus: "unpaid",
          items: {
            create: [
              {
                productId,
                productName: "ISS-0010 test product",
                quantity: 1,
                price: 10,
                subtotal: 10,
              },
            ],
          },
        },
      });
      orderIds.push(order.id);

      const before = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

      const [a, b] = await Promise.allSettled([
        syncOrderPaymentStatusFromInvoice(order.id, {
          amountPaid: 10,
          total: 10,
          invoiceStatus: "sent",
        }),
        syncOrderPaymentStatusFromInvoice(order.id, {
          amountPaid: 10,
          total: 10,
          invoiceStatus: "sent",
        }),
      ]);
      expect([a, b].every((r) => r.status === "fulfilled")).toBe(true);

      const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(refreshedOrder.status).toBe("confirmed");
      expect(refreshedOrder.paymentStatus).toBe("paid");

      const after = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      // Fulfilled exactly once (-1 quantity, -1 reserved), not twice.
      expect(Number(after.quantity)).toBe(Number(before.quantity) - 1);
      expect(Number(after.reservedQuantity)).toBe(Number(before.reservedQuantity) - 1);
    });
  },
);
