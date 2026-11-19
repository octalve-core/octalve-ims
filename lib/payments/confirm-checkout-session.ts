/**
 * REQ-0209 gap — Apply Stripe Checkout Session on browser return (`?payment=success&session_id=`).
 * Idempotent vs webhook: if PaymentIntent already stored, only re-run payment→status sync
 * (confirms Pending→Confirmed on first money when webhook used older logic or remote webhook).
 * REQ-0215 — after apply (and alreadyApplied), always heal invoice + sync order so
 * partial→remainder settle promotes invoice paid / order paymentStatus paid.
 */

import { getStripe } from "@/lib/stripe";
import { prisma } from "@/prisma/client";
import { applyStripeSessionPayment } from "@/lib/payments/apply-stripe-session-payment";
import { healInvoiceStatusAfterMoney } from "@/lib/invoices/heal-invoice-status-after-money";
import { invalidateOnOrderChange } from "@/lib/cache";
import { logger } from "@/lib/logger";

export type ConfirmCheckoutSessionResult = {
  ok: boolean;
  alreadyApplied: boolean;
  orderId?: string;
  invoiceId?: string;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  /** REQ-0215 — healed invoice status when available */
  invoiceStatus?: string | null;
  error?: string;
};

/** What a Checkout Session's own metadata says it's paying for — no DB/mutation. */
export type CheckoutSessionReference =
  | { ok: true; type: "order"; orderId: string }
  | { ok: true; type: "invoice"; invoiceId: string }
  | { ok: false; error: string };

/**
 * ISS-0008 — read-only: resolve which order/invoice a Checkout Session's
 * metadata references, without applying anything. Callers that need to
 * verify the requester actually owns that order/invoice (confirm-session's
 * route) call this BEFORE confirmCheckoutSessionById, which re-resolves the
 * same session for the actual (authorized-by-then) application.
 */
export async function resolveCheckoutSessionReference(
  sessionId: string,
): Promise<CheckoutSessionReference> {
  if (!sessionId.startsWith("cs_")) {
    return { ok: false, error: "Invalid session id" };
  }
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const metadata = session.metadata ?? {};
  const referenceId = metadata.referenceId;
  if (metadata.type === "order" && (metadata.orderId || referenceId)) {
    return { ok: true, type: "order", orderId: metadata.orderId || referenceId! };
  }
  if (metadata.type === "invoice" && (metadata.invoiceId || referenceId)) {
    return { ok: true, type: "invoice", invoiceId: metadata.invoiceId || referenceId! };
  }
  return { ok: false, error: "Unknown checkout type" };
}

/**
 * Retrieve Checkout Session and sync order/invoice money + fulfillment status.
 */
export async function confirmCheckoutSessionById(
  sessionId: string,
): Promise<ConfirmCheckoutSessionResult> {
  if (!sessionId.startsWith("cs_")) {
    return { ok: false, alreadyApplied: false, error: "Invalid session id" };
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return {
      ok: false,
      alreadyApplied: false,
      error: `Session not paid (${session.payment_status})`,
    };
  }

  const metadata = session.metadata ?? {};
  const type = metadata.type;
  const referenceId = metadata.referenceId;
  const orderIdMeta = metadata.orderId;
  const invoiceIdMeta = metadata.invoiceId;
  const sessionAmount = session.amount_total ? session.amount_total / 100 : 0;
  const metaCharge = metadata.chargeAmount
    ? Number.parseFloat(metadata.chargeAmount)
    : NaN;
  const chargeAmount =
    Number.isFinite(metaCharge) && metaCharge > 0 ? metaCharge : sessionAmount;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (type === "order" && (orderIdMeta || referenceId)) {
    const orderId = orderIdMeta || referenceId!;
    const orderExists = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!orderExists) {
      return { ok: false, alreadyApplied: false, error: "Order not found" };
    }

    // ISS-0008: applied atomically, deduped per-session (not per-"latest
    // PaymentIntent pointer") — see lib/payments/apply-stripe-session-payment.ts.
    const applied = await applyStripeSessionPayment({
      kind: "order",
      orderId,
      sessionId,
      paymentIntentId: paymentIntentId ?? null,
      chargeAmount,
    });

    // REQ-0215 — heal+sync always (sent→paid when settled; order partial→paid)
    const healed = await healInvoiceStatusAfterMoney(applied.invoiceId);

    await invalidateOnOrderChange();
    const refreshed = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true },
    });

    return {
      ok: true,
      alreadyApplied: applied.alreadyApplied,
      orderId,
      invoiceId: applied.invoiceId,
      paymentStatus: refreshed?.paymentStatus ?? null,
      orderStatus: refreshed?.status ?? null,
      invoiceStatus: healed?.status ?? null,
    };
  }

  if (type === "invoice" && (invoiceIdMeta || referenceId)) {
    const invoiceId = invoiceIdMeta || referenceId!;
    const invoiceExists = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, orderId: true },
    });
    if (!invoiceExists) {
      return { ok: false, alreadyApplied: false, error: "Invoice not found" };
    }

    const applied = await applyStripeSessionPayment({
      kind: "invoice",
      invoiceId,
      sessionId,
      paymentIntentId: paymentIntentId ?? null,
      chargeAmount,
    });

    // REQ-0215 — heal after apply or alreadyApplied (promotes stuck sent→paid)
    const healed = await healInvoiceStatusAfterMoney(invoiceId);
    await invalidateOnOrderChange();
    const orderId = healed?.orderId ?? applied.orderId ?? invoiceExists.orderId;
    const refreshed = orderId
      ? await prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true, paymentStatus: true },
        })
      : null;
    return {
      ok: true,
      alreadyApplied: applied.alreadyApplied,
      invoiceId,
      orderId,
      paymentStatus: refreshed?.paymentStatus ?? null,
      orderStatus: refreshed?.status ?? null,
      invoiceStatus: healed?.status ?? null,
    };
  }

  logger.warn("confirmCheckoutSession: unknown session type", {
    type,
    sessionId,
  });
  return { ok: false, alreadyApplied: false, error: "Unknown checkout type" };
}
