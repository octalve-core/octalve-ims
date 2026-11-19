/**
 * Maps a verified Shippo tracking status to the order status it implies.
 * Pure — the webhook route (ISS-0006) only calls this with a status it has
 * already re-fetched from Shippo's own API, never the raw webhook body.
 */
export function mapShippoStatusToOrderStatus(
  verifiedStatus: string | undefined,
  currentOrderStatus: string,
): string {
  const status = verifiedStatus?.toLowerCase();

  if (status === "delivered") return "delivered";
  if (status === "transit" || status === "in_transit") return "shipped";
  // "returned" / "failure" currently leave the order status unchanged
  // (logged as a shipping issue by the caller) — no "problem" order status
  // exists to flag it today.
  return currentOrderStatus;
}
