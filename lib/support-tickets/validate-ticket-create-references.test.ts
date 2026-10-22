import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import {
  isValidTicketAssignee,
  orderBelongsToClient,
} from "./validate-ticket-create-references";

/**
 * ISS-0022 — proves ticket creation can no longer trust an arbitrary
 * assignedToId/orderId: assignedToId must be a real product owner or an
 * admin; orderId must belong to the requesting client.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "validate-ticket-create-references (ISS-0022)",
  () => {
    const stamp = Date.now();
    let categoryId: string;
    let productId: string;
    let ownerUserId: string;
    const orderIds: string[] = [];

    beforeAll(async () => {
      const category = await prisma.category.create({
        data: {
          name: `ISS-0022 test category ${stamp}`,
          userId: "test-user",
          createdBy: "test-user",
        },
      });
      categoryId = category.id;

      ownerUserId = `iss-0022-owner-${stamp}`;
      const product = await prisma.product.create({
        data: {
          name: "ISS-0022 test product",
          price: 10,
          quantity: 5,
          sku: `iss-0022-${stamp}`,
          status: "active",
          userId: ownerUserId,
          createdBy: ownerUserId,
          categoryId,
          supplierId: "test-supplier",
        },
      });
      productId = product.id;
    });

    afterAll(async () => {
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      await prisma.product.delete({ where: { id: productId } });
      await prisma.category.delete({ where: { id: categoryId } });
    });

    it("accepts a real product owner as assignee", async () => {
      expect(await isValidTicketAssignee(ownerUserId)).toBe(true);
    });

    it("rejects an arbitrary user id with no products and no admin role", async () => {
      expect(await isValidTicketAssignee(`random-user-${stamp}`)).toBe(false);
    });

    it("rejects an orderId that doesn't belong to the requesting client", async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: `ISS-0022-${stamp}-other`,
          userId: "test-user",
          clientId: "client-a",
          createdBy: "test-user",
          subtotal: 10,
          total: 10,
        },
      });
      orderIds.push(order.id);

      expect(await orderBelongsToClient(order.id, "client-b")).toBe(false);
      expect(await orderBelongsToClient(order.id, "client-a")).toBe(true);
    });
  },
);
