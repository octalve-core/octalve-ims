/**
 * ISS-0011 — updateOrder accepted any status/paymentStatus combination with
 * no check against the order's current state, which allowed:
 *  - confirmed -> pending -> confirmed, double-decrementing stock (nothing
 *    stopped the backward hop, and nothing re-reserved after it)
 *  - a cancelled order "reactivated" to confirmed/paid by changing either
 *    status or just paymentStatus (closing ISS-0015's order-side half)
 *  - cancelling a delivered order, which still ran the generic
 *    confirmed/paid -> cancelled stock-restore path as if the goods were
 *    back in the warehouse, when they're already with the customer
 *  - cancelling a confirmed/paid order through this generic path at all,
 *    bypassing the refund-aware dedicated cancelOrder flow (ISS-0012)
 *
 * This is a forward-only progression plus cancel-from-non-terminal-state
 * gate, not a full state machine — it only needs to reject the specific
 * invalid hops above.
 */

const TERMINAL_STATUSES = new Set(["delivered", "cancelled"]);

const ALLOWED_NEXT_STATUS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
};

export function assertValidOrderStatusTransition(args: {
  previousStatus: string;
  newStatus: string;
  newPaymentStatus: string;
}): void {
  const { previousStatus, newStatus, newPaymentStatus } = args;

  // Terminal: no status or payment-status change may imply confirmed/paid
  // on a cancelled order — closes the "cancelled revived by paymentStatus
  // alone, status unchanged" loophole.
  if (previousStatus === "cancelled" && newPaymentStatus === "paid") {
    throw new Error(
      "Cannot mark a cancelled order as paid — create a new order instead",
    );
  }

  if (newStatus === previousStatus) return;

  if (TERMINAL_STATUSES.has(previousStatus)) {
    throw new Error(
      previousStatus === "delivered"
        ? "Cannot change the status of a delivered order through this update"
        : "Cannot change the status of a cancelled order — create a new order instead",
    );
  }

  const allowed = ALLOWED_NEXT_STATUS[previousStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot move order from "${previousStatus}" to "${newStatus}". ` +
        (newStatus === "cancelled"
          ? "Cancel a confirmed or paid order through the dedicated cancel action instead."
          : `Allowed next: ${allowed.join(", ") || "none"}.`),
    );
  }
}
