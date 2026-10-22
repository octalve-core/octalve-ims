import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import {
  claimOrderForLabelPurchase,
  releaseOrderLabelClaim,
} from "./claim-label-slot";

/**
 * ISS-0014 — proves the atomic claim actually closes the concurrent
 * double-label-purchase race, against a real Postgres connection: a
 * mock can't exercise "two concurrent UPDATEs serialize on the row
 * lock," only that the right call happened.
 */
describe.skipIf(!process.env.DATABASE_URL)("claimOrderForLabelPurchase (ISS-0014)", () => {
  const stamp = Date.now();
  const orderIds: string[] = [];

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  });

  async function createOrder(suffix: string) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `ISS-0014-${stamp}-${suffix}`,
        userId: "test-user",
        createdBy: "test-user",
        subtotal: 10,
        total: 10,
      },
    });
    orderIds.push(order.id);
    return order;
  }

  it("only lets one of two concurrent claims on the same order succeed", async () => {
    const order = await createOrder("concurrent");

    const [a, b] = await Promise.all([
      claimOrderForLabelPurchase(order.id),
      claimOrderForLabelPurchase(order.id),
    ]);

    expect([a, b].filter(Boolean).length).toBe(1);

    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.trackingNumber).not.toBeNull();
  });

  it("rejects a claim on an order that already has a tracking number", async () => {
    const order = await createOrder("already-tracked");
    await prisma.order.update({
      where: { id: order.id },
      data: { trackingNumber: "1Z999AA10123456784" },
    });

    const claimed = await claimOrderForLabelPurchase(order.id);
    expect(claimed).toBe(false);

    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.trackingNumber).toBe("1Z999AA10123456784");
  });

  it("release lets a subsequent claim succeed again", async () => {
    const order = await createOrder("release-then-reclaim");

    expect(await claimOrderForLabelPurchase(order.id)).toBe(true);
    await releaseOrderLabelClaim(order.id);

    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.trackingNumber).toBeNull();

    expect(await claimOrderForLabelPurchase(order.id)).toBe(true);
  });
});
