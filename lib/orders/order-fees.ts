/**
 * ISS-0016 — tax, shipping and discount are a fixed schedule derived from
 * the order subtotal, not a value the buyer chooses. The create-order API
 * used to trust whatever tax/shipping/discount numbers arrived in the
 * request body (the client just happened to compute and send these); a
 * caller hitting the API directly could submit an arbitrary discount and
 * drive the total to zero or negative. The order-creation form (for
 * display) and the server (for the actual charge) now both derive these
 * from this same formula instead of the server trusting client input.
 */

/** Tax: 7% of subtotal (hardcoded). */
const TAX_RATE = 0.07;
/** Shipping: fixed $4.99 (hardcoded). */
const SHIPPING_FIXED = 4.99;

/**
 * Discount percent by subtotal tiers (hardcoded):
 * < $100 → 10%, $100–$300 → 20%, $300–$500 → 30%, $500+ → 50%
 */
function getDiscountPercent(subtotal: number): number {
  if (subtotal < 100) return 10;
  if (subtotal < 300) return 20;
  if (subtotal < 500) return 30;
  return 50;
}

export type OrderFees = {
  taxAmount: number;
  shippingAmount: number;
  discountPercent: number;
  discountAmount: number;
};

/** Compute tax, shipping, and discount amounts from subtotal. */
export function getOrderFeesFromSubtotal(subtotal: number): OrderFees {
  const taxAmount = subtotal * TAX_RATE;
  const discountPercent = getDiscountPercent(subtotal);
  const discountAmount = subtotal * (discountPercent / 100);
  // Free shipping on the 10% (< $100) discount tier — keeps total <= subtotal on small orders.
  const shippingAmount = discountPercent === 10 ? 0 : SHIPPING_FIXED;
  return { taxAmount, shippingAmount, discountPercent, discountAmount };
}
