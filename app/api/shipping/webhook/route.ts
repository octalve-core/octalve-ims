/**
 * Shippo Webhook Handler
 * POST /api/shipping/webhook — handle Shippo tracking events
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/prisma/client";
import { sendOrderStatusUpdate } from "@/lib/email";
import { getShippo, isShippoConfigured } from "@/lib/shippo/server";
import { mapShippoStatusToOrderStatus } from "@/lib/shippo/map-tracking-status-to-order-status";
import type { OrderStatusUpdateData } from "@/lib/email/types";
import type { ShippoWebhookPayload } from "@/types";

import { invalidateOnOrderChange } from "@/lib/cache";
/**
 * POST /api/shipping/webhook
 * Handles Shippo webhook events (tracking updates)
 *
 * ISS-0006 — Shippo doesn't sign its webhooks (its own SDK's
 * `validateWebhook` only checks the payload's JSON shape, not its origin),
 * so anyone who knows an order's tracking number could POST a fake
 * `track_updated` event claiming any status. Instead of trusting the
 * claimed `tracking_status` from the request body, this re-fetches the
 * REAL status from Shippo's own API (authenticated with our API key) for
 * the tracking_number/carrier named in the request, and only ever applies
 * that verified status — a forged claim in the body is simply ignored.
 */
export async function POST(request: NextRequest) {
  try {
    const body: ShippoWebhookPayload = await request.json();
    const { event, data } = body;

    logger.info(`Received Shippo webhook: ${event}`);

    if (event === "track_updated" && data) {
      const { tracking_number, carrier } = data;

      if (!tracking_number || !carrier) {
        logger.warn("Shippo webhook missing tracking number or carrier");
        return NextResponse.json({ received: true });
      }

      if (!isShippoConfigured()) {
        logger.warn("Shippo webhook received but Shippo is not configured; ignoring");
        return NextResponse.json({ received: true });
      }

      // Find order by tracking number
      const order = await prisma.order.findFirst({
        where: { trackingNumber: tracking_number },
      });

      if (!order) {
        logger.info(`Order not found for tracking number: ${tracking_number}`);
        return NextResponse.json({ received: true });
      }

      let verifiedStatus: string | undefined;
      try {
        const verifiedTrack = await getShippo().trackingStatus.get(
          tracking_number,
          carrier,
        );
        verifiedStatus = verifiedTrack.trackingStatus?.status;
      } catch (err) {
        logger.warn("Shippo webhook: failed to verify tracking status via API, ignoring", {
          trackingNumber: tracking_number,
          carrier,
          error: err,
        });
        return NextResponse.json({ received: true });
      }

      // Map verified Shippo status to our order status
      const newStatus = mapShippoStatusToOrderStatus(verifiedStatus, order.status);
      const lowerStatus = verifiedStatus?.toLowerCase();
      if (lowerStatus === "returned" || lowerStatus === "failure") {
        logger.warn(`Shipping issue for order ${order.id}: ${lowerStatus}`);
      }

      // Update order if status changed
      if (newStatus !== order.status) {
        const prevStatus = order.status;

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: newStatus,
            updatedAt: new Date(),
          },
        });

        // Invalidate caches
    await invalidateOnOrderChange();
        logger.info(
          `Order ${order.id} status updated to ${newStatus} via Shippo webhook`,
        );

        // Send order status update email (async, non-blocking)
        if (order.clientId) {
          const client = await prisma.user.findUnique({
            where: { id: order.clientId },
            select: { email: true, username: true },
          });

          if (client?.email) {
            const statusUpdateData: OrderStatusUpdateData = {
              orderNumber: order.orderNumber,
              clientName: client.username || "Valued Customer",
              clientEmail: client.email,
              previousStatus: prevStatus,
              newStatus,
              statusMessage:
                newStatus === "delivered"
                  ? "Your order has been delivered! We hope you enjoy your purchase."
                  : `Your order status has been updated to "${newStatus}".`,
            };
            sendOrderStatusUpdate(
              statusUpdateData,
              client.email,
              client.username || undefined,
            ).catch((err) =>
              logger.warn("Failed to send status update email", { error: err }),
            );
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Shippo webhook handler error:", error);
    // Return 200 even on error to prevent Shippo from retrying
    return NextResponse.json({ received: true, error: "Internal error" });
  }
}
