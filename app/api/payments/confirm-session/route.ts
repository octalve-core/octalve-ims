/**
 * POST /api/payments/confirm-session
 * REQ-0209 — Browser return from Stripe applies/syncs payment when webhook is delayed
 * or hits another host. Idempotent with webhook via PaymentIntent match.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/utils/auth";
import { logger } from "@/lib/logger";
import { isStripeConfigured } from "@/lib/stripe";
import { withRateLimit, defaultRateLimits } from "@/lib/api/rate-limit";
import { confirmCheckoutSessionBodySchema } from "@/lib/validations/payment";
import {
  confirmCheckoutSessionById,
  resolveCheckoutSessionReference,
} from "@/lib/payments/confirm-checkout-session";
import { getOrderById, getOrderByIdForProductOwner } from "@/prisma/order";
import { getInvoiceById, getInvoiceByIdForProductOwner } from "@/prisma/invoice";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await withRateLimit(
      request,
      defaultRateLimits.standard,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Payment system is not configured" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = confirmCheckoutSessionBodySchema.safeParse(body);
    if (!parsed.success) {
      logger.warn("Invalid confirm-session body", {
        errors: parsed.error.errors,
      });
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 },
      );
    }

    // ISS-0008: a valid session + a session cookie used to be enough to
    // confirm ANY Checkout Session, including someone else's order/invoice
    // — the sessionId was never checked against the caller's own orders.
    // Admin keeps full access (consistent with ISS-0002's reassessment:
    // this is a single-tenant app, admin legitimately manages every order
    // in the one company); everyone else must be the order's buyer or own
    // a product in it, same ownership shape as the order PUT/DELETE routes.
    if (session.role !== "admin") {
      const ref = await resolveCheckoutSessionReference(parsed.data.sessionId);
      if (!ref.ok) {
        return NextResponse.json({ error: ref.error }, { status: 400 });
      }
      const owns =
        ref.type === "order"
          ? (await getOrderById(ref.orderId, session.id)) ||
            (await getOrderByIdForProductOwner(ref.orderId, session.id))
          : (await getInvoiceById(ref.invoiceId, session.id)) ||
            (await getInvoiceByIdForProductOwner(ref.invoiceId, session.id));
      if (!owns) {
        logger.warn("confirm-session: ownership check failed", {
          userId: session.id,
          sessionId: parsed.data.sessionId,
        });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await confirmCheckoutSessionById(parsed.data.sessionId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to confirm session" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      alreadyApplied: result.alreadyApplied,
      orderId: result.orderId,
      invoiceId: result.invoiceId,
      paymentStatus: result.paymentStatus,
      orderStatus: result.orderStatus,
      // REQ-0215 — client patch invoice badge to paid after remainder settle
      invoiceStatus: result.invoiceStatus,
    });
  } catch (error) {
    logger.error("confirm-session failed:", error);
    return NextResponse.json(
      { error: "Failed to confirm checkout session" },
      { status: 500 },
    );
  }
}
