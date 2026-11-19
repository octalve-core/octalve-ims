/**
 * Stripe Refund Utilities
 * Used when cancelling/refunding paid orders or invoices
 */

import { logger } from "@/lib/logger";
import { getStripe, isStripeConfigured } from "./server";

/**
 * Create a full refund for a Stripe PaymentIntent.
 * Uses the test-mode API key when STRIPE_API_KEY is for test mode.
 *
 * @param paymentIntentId - Stripe PaymentIntent ID (e.g. pi_xxx)
 * @param reason - Optional refund reason: duplicate, fraudulent, requested_by_customer
 * @returns Stripe Refund object or null if refund failed/skipped
 */
export async function createStripeRefund(
  paymentIntentId: string,
  reason?: "duplicate" | "fraudulent" | "requested_by_customer",
): Promise<{ id: string } | null> {
  if (!isStripeConfigured()) {
    logger.warn("Stripe refund skipped: Stripe is not configured");
    return null;
  }

  if (!paymentIntentId) {
    logger.warn("Stripe refund skipped: no payment intent ID");
    return null;
  }

  try {
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: reason ?? "requested_by_customer",
    });

    logger.info(`Stripe refund created: ${refund.id} for PaymentIntent ${paymentIntentId}`);
    return { id: refund.id };
  } catch (error) {
    // ISS-0012: only the specific "already refunded" error code is a safe,
    // idempotent no-op. `StripeInvalidRequestError` is a broad category that
    // also covers a bad payment_intent id, a charge that was never captured,
    // an amount exceeding what's refundable, etc. — real failures where no
    // money moved. The old code treated ALL of those as "already refunded,
    // skip", so a caller saw success (null, not a throw) for failures it
    // should have surfaced; see refund-all-order-payments.ts / cancelOrder,
    // which now only mark an order "refunded" when this doesn't throw.
    const err = error as { code?: string };
    if (err.code === "charge_already_refunded") {
      logger.info(`PaymentIntent ${paymentIntentId} already refunded, skipping`);
      return null;
    }
    logger.error("Stripe refund failed", { paymentIntentId, error });
    throw error;
  }
}
