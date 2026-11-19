import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import { applyStripeChargeRefund } from "./apply-stripe-charge-refund";

/**
 * ISS-0013 — proves the actual bugs are closed, against a real Postgres
 * connection (not a mocked Prisma client): a mock can't exercise the
 * unique-constraint-as-concurrency-primitive behavior this fix depends on.
 * Same real-DB convention as apply-stripe-session-payment.test.ts.
 */
describe.skipIf(!process.env.DATABASE_URL)("applyStripeChargeRefund", () => {
  const stamp = Date.now();
  let categoryId: string;
  let productId: string;
  const orderIds: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `ISS-0013 test category ${stamp}`,
        userId: "test-user",
        createdBy: "test-user",
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: "ISS-0013 test product",
        price: 100,
        quantity: 100,
        sku: `iss-0013-${stamp}`,
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
    await prisma.processedRefund.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  /** A fresh fully-paid $100 order (qty 2) + invoice, both stamped with the same PaymentIntent. */
  async function createPaidFixture(suffix: string, paymentIntentId: string) {
    const order = await prisma.order.create({
      data: {
        orderNumber: `ISS-0013-${stamp}-${suffix}`,
        userId: "test-user",
        createdBy: "test-user",
        subtotal: 100,
        total: 100,
        paymentStatus: "paid",
        stripePaymentIntentId: paymentIntentId,
        items: {
          create: [
            {
              productId,
              productName: "ISS-0013 test product",
              quantity: 2,
              price: 50,
              subtotal: 100,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-ISS-0013-${stamp}-${suffix}`,
        orderId: order.id,
        userId: "test-user",
        createdBy: "test-user",
        status: "paid",
        total: 100,
        amountPaid: 100,
        amountDue: 0,
        dueDate: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
    });

    return { order, invoice };
  }

  async function productQuantity(): Promise<number> {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    return Number(product.quantity);
  }

  it("fully refunds exactly once: cancels order+invoice and restocks exactly once", async () => {
    const before = await productQuantity();
    const { order, invoice } = await createPaidFixture("full", `pi_full_${stamp}`);

    const result = await applyStripeChargeRefund({
      refundId: `re_full_${stamp}`,
      chargeId: `ch_full_${stamp}`,
      paymentIntentId: `pi_full_${stamp}`,
      amountRefunded: 100,
      isFullyRefunded: true,
    });

    expect(result.alreadyProcessed).toBe(false);
    expect(result.applied).toBe(true);

    const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.paymentStatus).toBe("refunded");
    expect(refreshedOrder.status).toBe("cancelled");

    const refreshedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(refreshedInvoice.status).toBe("cancelled");
    expect(refreshedInvoice.amountDue).toBe(0);

    // Exactly 2 units restored (the order's quantity), not 4 from a double path.
    const after = await productQuantity();
    expect(after).toBe(before + 2);
  });

  it("applies a refund exactly once under two concurrent deliveries (duplicate webhook)", async () => {
    const before = await productQuantity();
    const { order } = await createPaidFixture("concurrent", `pi_concurrent_${stamp}`);
    const refundId = `re_concurrent_${stamp}`;

    const [a, b] = await Promise.all([
      applyStripeChargeRefund({
        refundId,
        chargeId: `ch_concurrent_${stamp}`,
        paymentIntentId: `pi_concurrent_${stamp}`,
        amountRefunded: 100,
        isFullyRefunded: true,
      }),
      applyStripeChargeRefund({
        refundId,
        chargeId: `ch_concurrent_${stamp}`,
        paymentIntentId: `pi_concurrent_${stamp}`,
        amountRefunded: 100,
        isFullyRefunded: true,
      }),
    ]);

    const appliedCount = [a, b].filter((r) => r.applied).length;
    expect(appliedCount).toBe(1);

    const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.paymentStatus).toBe("refunded");

    // 2 units restored once, not 4 from both callers racing.
    const after = await productQuantity();
    expect(after).toBe(before + 2);
  });

  it("rejects a replay of an already-processed refund id", async () => {
    const before = await productQuantity();
    const { order } = await createPaidFixture("replay", `pi_replay_${stamp}`);
    const refundId = `re_replay_${stamp}`;

    const first = await applyStripeChargeRefund({
      refundId,
      chargeId: `ch_replay_${stamp}`,
      paymentIntentId: `pi_replay_${stamp}`,
      amountRefunded: 100,
      isFullyRefunded: true,
    });
    expect(first.applied).toBe(true);

    const afterFirst = await productQuantity();
    expect(afterFirst).toBe(before + 2);

    const replay = await applyStripeChargeRefund({
      refundId,
      chargeId: `ch_replay_${stamp}`,
      paymentIntentId: `pi_replay_${stamp}`,
      amountRefunded: 100,
      isFullyRefunded: true,
    });
    expect(replay.alreadyProcessed).toBe(true);
    expect(replay.applied).toBe(false);

    const afterReplay = await productQuantity();
    // Still +2 total, not +4 from the replay restocking again.
    expect(afterReplay).toBe(before + 2);

    const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.paymentStatus).toBe("refunded");
  });

  it("does NOT cancel or restock on a partial refund (Failure: whole order cancelled on partial refund)", async () => {
    const before = await productQuantity();
    const { order, invoice } = await createPaidFixture("partial", `pi_partial_${stamp}`);

    const result = await applyStripeChargeRefund({
      refundId: `re_partial_${stamp}`,
      chargeId: `ch_partial_${stamp}`,
      paymentIntentId: `pi_partial_${stamp}`,
      amountRefunded: 10,
      isFullyRefunded: false,
    });

    expect(result.alreadyProcessed).toBe(false);
    expect(result.applied).toBe(false);

    const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.paymentStatus).toBe("paid");
    expect(refreshedOrder.status).toBe("pending");

    const refreshedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(refreshedInvoice.status).toBe("paid");

    // No stock change for a partial refund.
    const after = await productQuantity();
    expect(after).toBe(before);

    // But the ledger still recorded it, for audit / manual follow-up.
    const ledgerRow = await prisma.processedRefund.findUnique({
      where: { refundId: `re_partial_${stamp}` },
    });
    expect(ledgerRow).not.toBeNull();
    expect(ledgerRow?.amount).toBe(10);
  });
});
