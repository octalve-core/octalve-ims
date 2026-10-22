import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/prisma/client";
import { createStripeRefund } from "@/lib/stripe/refund";
import { refundAllOrderPayments } from "./refund-all-order-payments";

vi.mock("@/lib/stripe/refund", () => ({
  createStripeRefund: vi.fn(),
}));

/**
 * ISS-0012 — real Postgres connection for the ProcessedPayment ledger
 * lookup (same convention as apply-stripe-session-payment.test.ts), but
 * createStripeRefund is mocked: this proves refundAllOrderPayments'
 * own logic (which PaymentIntents it collects and whether "refunded" is
 * honest), not Stripe's SDK.
 */
describe.skipIf(!process.env.DATABASE_URL)("refundAllOrderPayments", () => {
  const stamp = Date.now();
  const orderIds: string[] = [];

  beforeEach(() => {
    vi.mocked(createStripeRefund).mockReset();
  });

  afterAll(async () => {
    await prisma.processedPayment.deleteMany({ where: { orderId: { in: orderIds } } });
  });

  async function seedLedger(
    orderId: string,
    invoiceId: string | null,
    paymentIntentId: string,
    sessionId: string,
  ) {
    await prisma.processedPayment.create({
      data: { sessionId, paymentIntentId, orderId, invoiceId, amount: 50 },
    });
  }

  it("refunds every distinct PaymentIntent on record, not just one", async () => {
    const orderId = `order-${stamp}-multi`;
    orderIds.push(orderId);
    await seedLedger(orderId, null, `pi_multi_a_${stamp}`, `cs_multi_a_${stamp}`);
    await seedLedger(orderId, null, `pi_multi_b_${stamp}`, `cs_multi_b_${stamp}`);

    vi.mocked(createStripeRefund).mockResolvedValue({ id: "re_mock" });

    const result = await refundAllOrderPayments(orderId, null, null);

    expect(result.allSucceeded).toBe(true);
    expect(result.refundedPaymentIntentIds.sort()).toEqual(
      [`pi_multi_a_${stamp}`, `pi_multi_b_${stamp}`].sort(),
    );
    expect(createStripeRefund).toHaveBeenCalledTimes(2);
  });

  it("does NOT report success when a real Stripe refund failure occurs (Failure: falsely marked refunded)", async () => {
    const orderId = `order-${stamp}-fail`;
    orderIds.push(orderId);
    await seedLedger(orderId, null, `pi_fail_${stamp}`, `cs_fail_${stamp}`);

    vi.mocked(createStripeRefund).mockRejectedValue(
      Object.assign(new Error("No such payment_intent"), { code: "resource_missing" }),
    );

    const result = await refundAllOrderPayments(orderId, null, null);

    expect(result.allSucceeded).toBe(false);
    expect(result.failedPaymentIntentIds).toEqual([`pi_fail_${stamp}`]);
  });

  it("falls back to the legacy single pointer when no ledger rows exist (pre-ISS-0008 orders)", async () => {
    const orderId = `order-${stamp}-legacy`;
    orderIds.push(orderId);

    vi.mocked(createStripeRefund).mockResolvedValue({ id: "re_mock" });

    const result = await refundAllOrderPayments(orderId, null, `pi_legacy_${stamp}`);

    expect(result.allSucceeded).toBe(true);
    expect(result.refundedPaymentIntentIds).toEqual([`pi_legacy_${stamp}`]);
  });

  it("is vacuously successful when there is nothing to refund (manually-paid order, no Stripe charge)", async () => {
    const orderId = `order-${stamp}-none`;
    orderIds.push(orderId);

    const result = await refundAllOrderPayments(orderId, null, null);

    expect(result.allSucceeded).toBe(true);
    expect(result.refundedPaymentIntentIds).toEqual([]);
    expect(createStripeRefund).not.toHaveBeenCalled();
  });
});
