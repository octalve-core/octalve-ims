/**
 * ISS-0014 — the label-purchase route used to check `order.trackingNumber`
 * with a plain read, then call Shippo's (slow, money-charging) purchase
 * API, then write the real tracking number back. Two concurrent requests
 * for the same order could both pass the stale read and both purchase a
 * label before either write landed — a real double-spend, not just a
 * data race. claimOrderForLabelPurchase makes the check-and-claim one
 * atomic UPDATE: its row lock is the concurrency primitive, so only one
 * concurrent caller's claim can ever succeed. releaseOrderLabelClaim
 * undoes it if the purchase fails after the claim is taken.
 */

import { prisma } from "@/prisma/client";

export const PENDING_LABEL_PURCHASE_PREFIX = "PENDING_LABEL_PURCHASE_";

/** Returns true if this call won the claim; false if the order already has (or is mid-claiming) a tracking number. */
export async function claimOrderForLabelPurchase(orderId: string): Promise<boolean> {
  const sentinel = `${PENDING_LABEL_PURCHASE_PREFIX}${Date.now()}`;
  const claimed = await prisma.$executeRaw`
    UPDATE "Order"
    SET "trackingNumber" = ${sentinel}
    WHERE id = ${orderId} AND "trackingNumber" IS NULL
  `;
  return claimed > 0;
}

/** Releases a claim this call took but didn't follow through on (purchase failed, or any error before the real tracking number was written). */
export async function releaseOrderLabelClaim(orderId: string): Promise<void> {
  await prisma.order
    .update({ where: { id: orderId }, data: { trackingNumber: null } })
    .catch(() => {});
}
