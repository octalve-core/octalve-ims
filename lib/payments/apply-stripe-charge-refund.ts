/**
 * ISS-0013 — the single place a Stripe `charge.refunded` event is actually
 * applied to an order/invoice. Replaces the old handleChargeRefunded body
 * (app/api/payments/webhook/route.ts), which had three separate bugs:
 *
 *  1. Treated ANY refund (including a partial one, e.g. a goodwill credit)
 *     as if the whole charge had been refunded — cancelling the order and
 *     restocking every item for money that mostly still belongs to us.
 *  2. Mutated order, product stock and invoice across several independent,
 *     non-transactional statements — a crash partway through could leave a
 *     torn state (order cancelled but stock not restored, or vice versa).
 *  3. Had no idempotency claim: Stripe documents webhooks as at-least-once
 *     delivery, and a refund started from our own cancelOrder flow also
 *     triggers this same webhook — so two deliveries of the same refund
 *     could both read "not yet refunded" and both restock the same items.
 *
 * Fixed the same way as ISS-0008 (apply-stripe-session-payment.ts): the
 * whole thing runs in one transaction whose first statement inserts a
 * ProcessedRefund row keyed on the specific Stripe Refund object's id
 * (refundId @unique) — the unique constraint is both the permanent dedup
 * record and the concurrency primitive, so a losing concurrent/duplicate
 * delivery's entire transaction aborts before touching stock or status.
 *
 * Only a FULLY refunded charge cancels the order/invoice and restocks.
 * A partial refund is recorded in the ledger (for audit) but leaves
 * order/invoice state untouched — there's no modeled "partially refunded"
 * status today, and inventing one is a product decision, not this fix's
 * scope; it logs clearly so it can be handled manually.
 */

import { prisma } from "@/prisma/client";
import { isPrismaUniqueConstraintViolation } from "@/lib/api/prisma-errors";
import { logger } from "@/lib/logger";

export type ApplyStripeChargeRefundArgs = {
  refundId: string;
  chargeId: string;
  paymentIntentId: string;
  amountRefunded: number;
  isFullyRefunded: boolean;
};

export type ApplyStripeChargeRefundResult = {
  alreadyProcessed: boolean;
  /** true if this call actually cancelled + restocked something (full refund, first delivery). */
  applied: boolean;
  orderId: string | null;
  invoiceId: string | null;
};

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function applyStripeChargeRefund(
  args: ApplyStripeChargeRefundArgs,
): Promise<ApplyStripeChargeRefundResult> {
  try {
    return await prisma.$transaction(async (tx: Tx) => {
      // Same dual lookup as the pre-fix handler: Order and Invoice can carry
      // different stripePaymentIntentId values under partial, multi-session
      // payment (see ISS-0012), so they may resolve to different rows.
      const order = await tx.order.findFirst({
        where: { stripePaymentIntentId: args.paymentIntentId },
        include: { items: true, invoice: true },
      });
      const invoiceRecord = await tx.invoice.findFirst({
        where: { stripePaymentIntentId: args.paymentIntentId },
        include: { order: { include: { items: true } } },
      });

      // Claim the refund id FIRST — see module doc for why this is both the
      // dedup record and the concurrency primitive.
      await tx.processedRefund.create({
        data: {
          refundId: args.refundId,
          chargeId: args.chargeId,
          orderId: order?.id ?? invoiceRecord?.order?.id ?? null,
          invoiceId: invoiceRecord?.id ?? order?.invoice?.id ?? null,
          amount: args.amountRefunded,
        },
      });

      if (!order && !invoiceRecord) {
        logger.warn("charge.refunded: no order or invoice found for PaymentIntent", {
          paymentIntentId: args.paymentIntentId,
          chargeId: args.chargeId,
        });
        return { alreadyProcessed: false, applied: false, orderId: null, invoiceId: null };
      }

      if (!args.isFullyRefunded) {
        logger.warn(
          "Partial Stripe refund recorded; order/invoice left unchanged (needs manual review)",
          {
            chargeId: args.chargeId,
            refundId: args.refundId,
            paymentIntentId: args.paymentIntentId,
            amountRefunded: args.amountRefunded,
            orderId: order?.id,
            invoiceId: invoiceRecord?.id,
          },
        );
        return {
          alreadyProcessed: false,
          applied: false,
          orderId: order?.id ?? invoiceRecord?.order?.id ?? null,
          invoiceId: invoiceRecord?.id ?? order?.invoice?.id ?? null,
        };
      }

      let touchedOrderId: string | null = null;
      let touchedInvoiceId: string | null = null;

      if (order && order.paymentStatus !== "refunded") {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "refunded",
            status: "cancelled",
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        });
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }
        if (order.invoice && order.invoice.status !== "cancelled") {
          await tx.invoice.update({
            where: { id: order.invoice.id },
            data: {
              status: "cancelled",
              cancelledAt: new Date(),
              amountDue: 0,
              updatedAt: new Date(),
            },
          });
        }
        touchedOrderId = order.id;
        touchedInvoiceId = order.invoice?.id ?? null;
        logger.info(`Order ${order.id} marked refunded from charge.refunded`);
      }

      // Only process the invoice-first path for an invoice not already
      // handled above — guards the exact "stock restored twice" failure
      // mode when order and invoiceRecord.order are the same entity.
      if (
        invoiceRecord &&
        invoiceRecord.status !== "cancelled" &&
        invoiceRecord.id !== touchedInvoiceId
      ) {
        await tx.invoice.update({
          where: { id: invoiceRecord.id },
          data: {
            status: "cancelled",
            cancelledAt: new Date(),
            amountDue: 0,
            updatedAt: new Date(),
          },
        });
        touchedInvoiceId = invoiceRecord.id;

        if (
          invoiceRecord.order &&
          invoiceRecord.order.paymentStatus !== "refunded" &&
          invoiceRecord.order.id !== touchedOrderId
        ) {
          await tx.order.update({
            where: { id: invoiceRecord.order.id },
            data: {
              paymentStatus: "refunded",
              status: "cancelled",
              cancelledAt: new Date(),
              updatedAt: new Date(),
            },
          });
          for (const item of invoiceRecord.order.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: item.quantity } },
            });
          }
          touchedOrderId = touchedOrderId ?? invoiceRecord.order.id;
        }
        logger.info(`Invoice ${invoiceRecord.id} marked cancelled from charge.refunded`);
      }

      return {
        alreadyProcessed: false,
        applied: Boolean(touchedOrderId || touchedInvoiceId),
        orderId: touchedOrderId,
        invoiceId: touchedInvoiceId,
      };
    });
  } catch (err) {
    if (isPrismaUniqueConstraintViolation(err, "refundId")) {
      logger.info("Stripe refund already processed, skipping", {
        refundId: args.refundId,
      });
      const existing = await prisma.processedRefund.findUnique({
        where: { refundId: args.refundId },
      });
      return {
        alreadyProcessed: true,
        applied: false,
        orderId: existing?.orderId ?? null,
        invoiceId: existing?.invoiceId ?? null,
      };
    }
    throw err;
  }
}
