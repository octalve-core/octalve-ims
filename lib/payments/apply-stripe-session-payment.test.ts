import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import { applyStripeSessionPayment } from "./apply-stripe-session-payment";

/**
 * ISS-0008 — proves the actual race/replay bugs are closed, against a real
 * Postgres connection (not a mocked Prisma client): a mock can't exercise
 * the unique-constraint-as-concurrency-primitive behavior this fix depends
 * on. Same real-DB convention as lib/server/tenant-prisma.test.ts — skipped
 * automatically if DATABASE_URL isn't set/reachable.
 */
describe.skipIf(!process.env.DATABASE_URL)("applyStripeSessionPayment", () => {
  const stamp = Date.now();
  let categoryId: string;
  let productId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `ISS-0008 test category ${stamp}`,
        userId: "test-user",
        createdBy: "test-user",
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: "ISS-0008 test product",
        price: 100,
        quantity: 100,
        sku: `iss-0008-${stamp}`,
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
    await prisma.processedPayment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  /** A fresh $100 order + $100 invoice (amountPaid 0), isolated per test. */
  async function createFixtureInvoice(suffix: string) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `ISS-0008-${stamp}-${suffix}`,
        userId: "test-user",
        createdBy: "test-user",
        subtotal: 100,
        total: 100,
        items: {
          create: [
            {
              productId,
              productName: "ISS-0008 test product",
              quantity: 1,
              price: 100,
              subtotal: 100,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-ISS-0008-${stamp}-${suffix}`,
        orderId: order.id,
        userId: "test-user",
        createdBy: "test-user",
        status: "sent",
        total: 100,
        amountPaid: 0,
        amountDue: 100,
        dueDate: new Date(),
      },
    });

    return invoice;
  }

  it("applies a session's charge exactly once under two concurrent calls (Failure A)", async () => {
    const invoice = await createFixtureInvoice("concurrent");
    const sessionId = `cs_test_concurrent_${stamp}`;

    const [a, b] = await Promise.all([
      applyStripeSessionPayment({
        kind: "invoice",
        invoiceId: invoice.id,
        sessionId,
        paymentIntentId: "pi_test_concurrent",
        chargeAmount: 50,
      }),
      applyStripeSessionPayment({
        kind: "invoice",
        invoiceId: invoice.id,
        sessionId,
        paymentIntentId: "pi_test_concurrent",
        chargeAmount: 50,
      }),
    ]);

    // Exactly one of the two concurrent callers actually applied the charge.
    const appliedCount = [a, b].filter((r) => !r.alreadyApplied).length;
    expect(appliedCount).toBe(1);

    const refreshed = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    // $50 charged once, not $100 from both callers racing.
    expect(refreshed.amountPaid).toBe(50);
    expect(refreshed.status).toBe("sent");
  });

  it("rejects a replay of an older session after a newer one applied (Failure B)", async () => {
    const invoice = await createFixtureInvoice("replay");

    const first = await applyStripeSessionPayment({
      kind: "invoice",
      invoiceId: invoice.id,
      sessionId: `cs_test_A_${stamp}`,
      paymentIntentId: "pi_test_A",
      chargeAmount: 50,
    });
    expect(first.alreadyApplied).toBe(false);

    const afterA = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(afterA.amountPaid).toBe(50);

    const second = await applyStripeSessionPayment({
      kind: "invoice",
      invoiceId: invoice.id,
      sessionId: `cs_test_B_${stamp}`,
      paymentIntentId: "pi_test_B",
      chargeAmount: 50,
    });
    expect(second.alreadyApplied).toBe(false);

    const afterB = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(afterB.amountPaid).toBe(100);
    expect(afterB.status).toBe("paid");

    // Replay the FIRST session again — old-pointer-based "alreadyApplied"
    // would see stripePaymentIntentId now pointing at B and re-credit A.
    const replay = await applyStripeSessionPayment({
      kind: "invoice",
      invoiceId: invoice.id,
      sessionId: `cs_test_A_${stamp}`,
      paymentIntentId: "pi_test_A",
      chargeAmount: 50,
    });
    expect(replay.alreadyApplied).toBe(true);

    const afterReplay = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    // Still $100, not $150 from the replay re-crediting A's charge again.
    expect(afterReplay.amountPaid).toBe(100);

    // Alternate back to B's session id too — same guarantee either direction.
    const replayB = await applyStripeSessionPayment({
      kind: "invoice",
      invoiceId: invoice.id,
      sessionId: `cs_test_B_${stamp}`,
      paymentIntentId: "pi_test_B",
      chargeAmount: 50,
    });
    expect(replayB.alreadyApplied).toBe(true);
    const afterReplayB = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(afterReplayB.amountPaid).toBe(100);
  });

  it("auto-creates the invoice on first charge (order kind, no prior invoice)", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `ISS-0008-${stamp}-autocreate`,
        userId: "test-user",
        createdBy: "test-user",
        subtotal: 100,
        total: 100,
        items: {
          create: [
            {
              productId,
              productName: "ISS-0008 test product",
              quantity: 1,
              price: 100,
              subtotal: 100,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);

    const result = await applyStripeSessionPayment({
      kind: "order",
      orderId: order.id,
      sessionId: `cs_test_autocreate_${stamp}`,
      paymentIntentId: "pi_test_autocreate",
      chargeAmount: 100,
    });

    expect(result.alreadyApplied).toBe(false);
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: result.invoiceId },
    });
    expect(invoice.orderId).toBe(order.id);
    expect(invoice.amountPaid).toBe(100);
    expect(invoice.status).toBe("paid");

    const refreshedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(refreshedOrder.stripePaymentIntentId).toBe("pi_test_autocreate");
  });
});
