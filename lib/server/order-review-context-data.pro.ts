/**
 * Batch SSR review context for order detail — Pro tier variant (identical
 * to the Core variant). Reviews (lib/product-reviews) are premium-exclusive,
 * so this tier's order/invoice detail routes get no review data at all:
 * every product is reported as ineligible with no reviews, which naturally
 * disables any "write a review" affordance downstream (ProductReviewsSection
 * itself is premium and isn't rendered in this tier either — see
 * components/shared/ProductLineItemsList.pro.tsx). Picked by
 * scripts/export-tier.ts in place of the default file when exporting Pro.
 * Keep in sync with order-review-context-data.core.ts — export-tier.ts
 * does exact-tier matching only, no cross-tier fallback. Every one of this
 * file's 7 callers (order/invoice detail routes) and its 3 downstream
 * type-only consumers (OrderItemsCard.tsx, InvoiceItemsCard.tsx,
 * ProductLineItemsList.tsx) is untouched — the tier swap happens
 * transparently at this file's identity, not at any caller.
 */
/** Locally-defined — the real ProductReview shape (types/product-review.ts) is
 * premium-only; every product is reported with an empty reviews array in this
 * tier (see below), so only the array shape needs to type-check downstream,
 * not the full record. */
type ProductReview = Record<string, unknown>;

/** Locally-defined — mirrors lib/product-reviews/product-reviews-detail-data.ts's
 * shape without importing premium code into a Core-bucketed file. */
type ReviewEligibilityResult = { eligible: boolean; slots: unknown[] };

export type OrderReviewContext = {
  reviewsByProductId: Record<string, ProductReview[]>;
  eligibilityByProductId: Record<string, ReviewEligibilityResult>;
};

export async function getOrderReviewContextForPage(
  _userId: string,
  _orderId: string,
  productIds: string[],
): Promise<OrderReviewContext> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  const reviewsByProductId: Record<string, ProductReview[]> = {};
  const eligibilityByProductId: Record<string, ReviewEligibilityResult> = {};
  for (const productId of uniqueIds) {
    reviewsByProductId[productId] = [];
    eligibilityByProductId[productId] = { eligible: false, slots: [] };
  }
  return { reviewsByProductId, eligibilityByProductId };
}
