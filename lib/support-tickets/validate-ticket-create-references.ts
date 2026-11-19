/**
 * ISS-0022 — support ticket creation used to trust `assignedToId`/`orderId`
 * straight from the request body with no validation at all: any caller
 * could point `assignedToId` at an arbitrary user id (triggering a
 * ticket-assigned notification to them and surfacing the ticket on their
 * assigned-to-me list) or attach another buyer's `orderId` (surfacing its
 * order number/status/payment status on the ticket's own detail page).
 */
import { prisma } from "@/prisma/client";

/** True when `assignedToId` is a legitimate ticket-routing target: a product owner, or an admin. */
export async function isValidTicketAssignee(
  assignedToId: string,
): Promise<boolean> {
  const [hasProduct, assignee] = await Promise.all([
    prisma.product.findFirst({
      where: { userId: assignedToId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: assignedToId },
      select: { role: true },
    }),
  ]);
  return !!hasProduct || assignee?.role === "admin";
}

/** True when `orderId` belongs to this client (buyer-side ownership). */
export async function orderBelongsToClient(
  orderId: string,
  clientUserId: string,
): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, clientId: clientUserId },
    select: { id: true },
  });
  return !!order;
}
