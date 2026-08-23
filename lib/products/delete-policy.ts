/**
 * Product delete strategy from related order line items.
 * - block: active orders (not delivered/cancelled)
 * - soft: order history exists, all orders completed → archive (deletedAt)
 * - hard: no order items → physical delete
 */

export const COMPLETED_ORDER_STATUSES = ["delivered", "cancelled"] as const;

export type CompletedOrderStatus = (typeof COMPLETED_ORDER_STATUSES)[number];

export type ProductDeleteStrategy = "block" | "soft" | "hard";

export interface OrderItemForDeletePolicy {
  order: { id: string; status: string };
}

/** True when order is still in progress (cannot delete/archive product yet). */
export function isActiveOrderStatus(status: string): boolean {
  return !COMPLETED_ORDER_STATUSES.includes(
    status as CompletedOrderStatus,
  );
}

/**
 * Decide how DELETE /api/products should handle this product.
 */
export function getDeleteStrategy(
  orderItems: OrderItemForDeletePolicy[],
): ProductDeleteStrategy {
  if (orderItems.length === 0) {
    return "hard";
  }

  const hasActive = orderItems.some((item) =>
    isActiveOrderStatus(item.order.status),
  );

  if (hasActive) {
    return "block";
  }

  return "soft";
}
