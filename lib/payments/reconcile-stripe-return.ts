/**
 * REQ-0209 — Run Stripe confirm-session during SSR before detail prefetch.
 * Avoids Pending→Confirmed flash: first HTML already has Confirmed + Partial/Paid.
 * Idempotent with webhook / browser confirm (PaymentIntent match).
 */

import {
  confirmCheckoutSessionById,
  resolveCheckoutSessionReference,
} from "@/lib/payments/confirm-checkout-session";
import { getOrderById, getOrderByIdForProductOwner } from "@/prisma/order";
import { getInvoiceById, getInvoiceByIdForProductOwner } from "@/prisma/invoice";
import { logger } from "@/lib/logger";

export type StripeReturnSearchParams = {
  payment?: string | string[];
  session_id?: string | string[];
};

function firstString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * If return URL has payment=success&session_id, sync DB then caller should redirect
 * to the clean detail path (no query) so UI never paints stale Pending.
 * Returns true when caller should redirect.
 *
 * ISS-0008: `session_id` is a URL query param, not tied to the path's order
 * id or to the viewer at all — without this check, a logged-in user could
 * navigate to their OWN order's detail page with someone else's `cs_...`
 * id tacked on and have that stranger's payment applied via this page's
 * normal SSR load, no API call needed. `viewer` is required (every caller
 * already has it from its own auth-gate) and is checked the same way the
 * order PUT/DELETE routes and /api/payments/confirm-session are: admin
 * bypasses (single-tenant — see ISS-0002), everyone else must be the
 * order/invoice's buyer or own a product in it.
 */
export async function reconcileStripeReturnBeforeDetail(
  searchParams: StripeReturnSearchParams,
  viewer: { id: string; role?: string | null },
): Promise<{ shouldRedirect: boolean; sessionId?: string }> {
  const payment = firstString(searchParams.payment);
  const sessionId = firstString(searchParams.session_id);

  if (payment !== "success" || !sessionId) {
    return { shouldRedirect: false };
  }

  try {
    if (viewer.role !== "admin") {
      const ref = await resolveCheckoutSessionReference(sessionId);
      if (!ref.ok) {
        logger.warn("SSR Stripe return: could not resolve session", {
          error: ref.error,
          sessionId,
        });
        return { shouldRedirect: true, sessionId };
      }
      const owns =
        ref.type === "order"
          ? (await getOrderById(ref.orderId, viewer.id)) ||
            (await getOrderByIdForProductOwner(ref.orderId, viewer.id))
          : (await getInvoiceById(ref.invoiceId, viewer.id)) ||
            (await getInvoiceByIdForProductOwner(ref.invoiceId, viewer.id));
      if (!owns) {
        logger.warn("SSR Stripe return: ownership check failed", {
          userId: viewer.id,
          sessionId,
        });
        return { shouldRedirect: true, sessionId };
      }
    }

    const result = await confirmCheckoutSessionById(sessionId);
    if (!result.ok) {
      logger.warn("SSR Stripe return reconcile failed", {
        error: result.error,
        sessionId,
      });
    }
  } catch (err) {
    logger.warn("SSR Stripe return reconcile threw", { error: err, sessionId });
  }

  // Always redirect off success query so client does not re-confirm / flash
  return { shouldRedirect: true, sessionId };
}
