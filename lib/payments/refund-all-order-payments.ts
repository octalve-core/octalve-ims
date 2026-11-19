/**
 * ISS-0012 — refunds every Stripe PaymentIntent actually charged for an
 * order/invoice, not just the single most-recently-stored one.
 *
 * Order.stripePaymentIntentId and Invoice.stripePaymentIntentId each only
 * remember the LATEST charge (see apply-stripe-session-payment.ts) — an
 * invoice paid across two partial Stripe sessions has two real charges on
 * two different PaymentIntents, but only the second overwrote the stored
 * pointer. Refunding only that pointer silently leaves the first charge's
 * money uncollected-back. The ProcessedPayment ledger (ISS-0008) durably
 * records every individual charge, so this refunds all of them.
 *
 * Orders paid before ProcessedPayment existed have no ledger rows at all;
 * for those, fall back to the single stored pointer so they aren't
 * silently skipped.
 */

import { prisma } from "@/prisma/client";
import { createStripeRefund } from "@/lib/stripe/refund";
import { logger } from "@/lib/logger";

export type RefundAllOrderPaymentsResult = {
  refundedPaymentIntentIds: string[];
  failedPaymentIntentIds: string[];
  /** true iff every PaymentIntent that was actually attempted refunded successfully (or was already refunded). Vacuously true if there was nothing to refund. */
  allSucceeded: boolean;
};

export async function refundAllOrderPayments(
  orderId: string,
  invoiceId: string | null,
  legacyFallbackPaymentIntentId: string | null,
): Promise<RefundAllOrderPaymentsResult> {
  const ledgerRows = await prisma.processedPayment.findMany({
    where: {
      OR: [{ orderId }, ...(invoiceId ? [{ invoiceId }] : [])],
    },
  });

  const paymentIntentIds = new Set(
    ledgerRows
      .map((row) => row.paymentIntentId)
      .filter((id): id is string => Boolean(id)),
  );

  if (paymentIntentIds.size === 0 && legacyFallbackPaymentIntentId) {
    paymentIntentIds.add(legacyFallbackPaymentIntentId);
  }

  const refunded: string[] = [];
  const failed: string[] = [];

  for (const paymentIntentId of paymentIntentIds) {
    try {
      await createStripeRefund(paymentIntentId, "requested_by_customer");
      refunded.push(paymentIntentId);
    } catch (err) {
      logger.error("Stripe refund failed for PaymentIntent during order cancellation", {
        orderId,
        invoiceId,
        paymentIntentId,
        error: err,
      });
      failed.push(paymentIntentId);
    }
  }

  return {
    refundedPaymentIntentIds: refunded,
    failedPaymentIntentIds: failed,
    allSucceeded: failed.length === 0,
  };
}
