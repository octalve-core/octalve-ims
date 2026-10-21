/**
 * ISS-0008 — the single place a Stripe Checkout Session's money is actually
 * applied to an order/invoice. Replaces the old "does this match the latest
 * stored PaymentIntent id" check (lib/payments/confirm-checkout-session.ts's
 * previous `alreadyApplied` logic), which only remembered the most recent
 * session — replaying an OLDER, already-applied session after a newer one
 * landed made the old one look unapplied again and re-credited amountPaid
 * for money that never moved twice.
 *
 * ProcessedPayment.sessionId is both the permanent per-session dedup record
 * AND the concurrency primitive: it's inserted as the FIRST statement of
 * the transaction that applies the charge, so two concurrent callers for
 * the same session (the webhook and the browser-return path both fire per
 * REQ-0209) can never both credit money — Postgres makes the losing INSERT
 * wait for the winner to commit or roll back, so by the time a caller sees
 * a unique-constraint error, the winning transaction has already fully
 * finished (see isPrismaUniqueConstraintViolation below). If anything after
 * the claim fails for an unrelated reason, the whole transaction —
 * including the claim — rolls back, so a legitimate retry (Stripe webhook
 * retry, user revisiting the return URL) isn't permanently blocked.
 *
 * amountPaid itself is mutated with Prisma's atomic `increment`, not a
 * read-then-write, so two genuinely different sessions paying into the
 * same invoice at once (not a replay — two real concurrent partial
 * payments) can't race each other either.
 */

import { prisma } from "@/prisma/client";
import { applyIncrementalInvoicePayment } from "@/lib/invoices/order-payment-sync";
import { resolveInvoiceBillingAddressInput } from "@/lib/invoices/resolve-invoice-billing-address";
import { generateInvoiceNumber } from "@/prisma/invoice";
import { isPrismaUniqueConstraintViolation } from "@/lib/api/prisma-errors";
import { logger } from "@/lib/logger";
import type { Invoice } from "@prisma/client";

export type ApplyStripeSessionPaymentArgs = {
  sessionId: string;
  paymentIntentId: string | null;
  chargeAmount: number;
} & ({ kind: "order"; orderId: string } | { kind: "invoice"; invoiceId: string });

export type ApplyStripeSessionPaymentResult = {
  alreadyApplied: boolean;
  invoiceId: string;
  orderId: string | null;
};

/** tx is the Prisma interactive-transaction client (inferred from $transaction's callback). */
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Atomically bump amountPaid, then derive status/amountDue/paidAt from the
 * post-increment value (capping at total, same business rules as before —
 * see applyIncrementalInvoicePayment). The increment itself can't overshoot
 * correctness even under true concurrent writers; only the derived fields
 * need a second statement, which is safe because they're computed from the
 * row this same transaction just wrote.
 */
async function incrementInvoicePaid(
  tx: Tx,
  invoice: Invoice,
  chargeAmount: number,
  paymentIntentId: string | null,
): Promise<void> {
  const bumped = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: { increment: Math.max(0, chargeAmount) },
      updatedAt: new Date(),
    },
  });

  const next = applyIncrementalInvoicePayment({
    priorAmountPaid: 0,
    total: bumped.total,
    chargeAmount: bumped.amountPaid,
    priorStatus: bumped.status,
  });

  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      // Only the most recently applied PaymentIntent is kept (matches prior
      // behavior) — refunding against multiple partial-payment PaymentIntents
      // is a separate, already-tracked gap (ISS-0012), not this fix's scope.
      stripePaymentIntentId: paymentIntentId ?? undefined,
      status: next.status,
      amountPaid: next.amountPaid,
      amountDue: next.amountDue,
      paidAt: next.fullyPaid ? new Date() : bumped.paidAt,
      updatedAt: new Date(),
    },
  });
}

/** Mirrors applyStripeChargeToOrderInvoice's auto-create branch (prisma/invoice.ts), on tx. */
async function createInvoiceForOrder(
  tx: Tx,
  orderId: string,
  chargeAmount: number,
  paymentIntentId: string | null,
): Promise<Invoice> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { product: { select: { userId: true } } } } },
  });

  const productOwnerIds = [
    ...new Set(
      order.items
        .map((item) => (item as { product?: { userId?: string } }).product?.userId)
        .filter(Boolean),
    ),
  ] as string[];
  const issuerId = productOwnerIds[0] ?? order.userId;

  const now = new Date();
  const total = order.total;
  const charge = chargeAmount > 0 ? chargeAmount : total;

  const next = applyIncrementalInvoicePayment({
    priorAmountPaid: 0,
    total,
    chargeAmount: charge,
    priorStatus: "sent",
  });

  const invoiceNumber = await generateInvoiceNumber();
  const subtotal = order.subtotal;
  const tax = order.tax ?? 0;
  const shipping = order.shipping ?? 0;
  const discount = order.discount ?? 0;
  const billingAddress = resolveInvoiceBillingAddressInput(order);

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber,
      orderId,
      userId: order.userId,
      clientId: order.clientId,
      status: next.status,
      subtotal,
      tax: tax > 0 ? tax : null,
      shipping: shipping > 0 ? shipping : null,
      discount: discount > 0 ? discount : null,
      total,
      amountPaid: next.amountPaid,
      amountDue: next.amountDue,
      dueDate: now,
      issuedAt: now,
      sentAt: now,
      paidAt: next.fullyPaid ? now : null,
      cancelledAt: null,
      paymentLink: null,
      stripePaymentIntentId: paymentIntentId ?? undefined,
      notes: next.fullyPaid
        ? "Auto-generated when order was paid via Stripe."
        : "Auto-generated from Stripe partial payment on order.",
      billingAddress,
      createdBy: issuerId,
      updatedBy: null,
      createdAt: now,
      updatedAt: null,
    },
  });

  logger.info("Invoice auto-created for Stripe order charge", {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    orderId,
    amountPaid: next.amountPaid,
  });

  return invoice;
}

export async function applyStripeSessionPayment(
  args: ApplyStripeSessionPaymentArgs,
): Promise<ApplyStripeSessionPaymentResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Claim the session id FIRST — see module doc for why this is both
      // the dedup record and the concurrency primitive.
      await tx.processedPayment.create({
        data: {
          sessionId: args.sessionId,
          paymentIntentId: args.paymentIntentId,
          orderId: args.kind === "order" ? args.orderId : null,
          amount: args.chargeAmount,
        },
      });

      let invoiceId: string;
      let orderId: string | null;

      if (args.kind === "invoice") {
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: args.invoiceId },
        });
        invoiceId = invoice.id;
        orderId = invoice.orderId;
        await incrementInvoicePaid(
          tx,
          invoice,
          args.chargeAmount,
          args.paymentIntentId,
        );
      } else {
        orderId = args.orderId;
        const existing = await tx.invoice.findUnique({
          where: { orderId: args.orderId },
        });
        if (existing) {
          invoiceId = existing.id;
          await incrementInvoicePaid(
            tx,
            existing,
            args.chargeAmount,
            args.paymentIntentId,
          );
        } else {
          const created = await createInvoiceForOrder(
            tx,
            args.orderId,
            args.chargeAmount,
            args.paymentIntentId,
          );
          invoiceId = created.id;
        }
        // Order itself also carries the latest PaymentIntent id (matches
        // prior behavior — read by cancelOrder's refund lookup and the
        // webhook's charge.refunded correlation).
        if (args.paymentIntentId) {
          await tx.order.update({
            where: { id: args.orderId },
            data: {
              stripePaymentIntentId: args.paymentIntentId,
              updatedAt: new Date(),
            },
          });
        }
      }

      await tx.processedPayment.update({
        where: { sessionId: args.sessionId },
        data: { invoiceId },
      });

      return { alreadyApplied: false, invoiceId, orderId };
    });
  } catch (err) {
    if (isPrismaUniqueConstraintViolation(err, "sessionId")) {
      logger.info("Stripe session already applied, skipping re-credit", {
        sessionId: args.sessionId,
      });
      const existing = await prisma.processedPayment.findUnique({
        where: { sessionId: args.sessionId },
      });
      if (existing?.invoiceId) {
        return {
          alreadyApplied: true,
          invoiceId: existing.invoiceId,
          orderId: existing.orderId,
        };
      }
      // Narrow window: the winning transaction committed the claim but
      // hasn't backfilled invoiceId yet (shouldn't outlast one DB
      // round-trip). Fall back to resolving it directly rather than
      // returning an invoiceId-less result a caller can't use.
      const invoice =
        args.kind === "invoice"
          ? await prisma.invoice.findUnique({ where: { id: args.invoiceId } })
          : await prisma.invoice.findUnique({ where: { orderId: args.orderId } });
      if (invoice) {
        return {
          alreadyApplied: true,
          invoiceId: invoice.id,
          orderId: invoice.orderId,
        };
      }
    }
    throw err;
  }
}
