/**
 * Batch SSR review context for order detail — avoids per-line-item client eligibility calls (REQ-0026).
 */
import {
  getReviewsForProductPage,
  getReviewEligibilityForProduct,
  type ReviewEligibilityResult,
} from "@/lib/product-reviews/product-reviews-detail-data";
import type { ProductReview } from "@/types";

export type OrderReviewContext = {
  reviewsByProductId: Record<string, ProductReview[]>;
  eligibilityByProductId: Record<string, ReviewEligibilityResult>;
};

/**
 * Prefetch reviews + eligibility for all unique product IDs on an order
 * (single server round-trip).
 *
 * ISS-0049: `viewerRole` is required (not optional) so a caller can't
 * silently fall back to the old "all" behavior by omitting it — whoever is
 * viewing this order (usually its own buyer, not the product's owner) only
 * gets to see other buyers' pending/rejected reviews if they're actually
 * admin or that product's owner; see resolvePublicReviewStatus.
 */
export async function getOrderReviewContextForPage(
  userId: string,
  orderId: string,
  productIds: string[],
  viewerRole: string | null,
): Promise<OrderReviewContext> {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { reviewsByProductId: {}, eligibilityByProductId: {} };
  }

  const entries = await Promise.all(
    uniqueIds.map(async (productId) => {
      const [reviews, eligibility] = await Promise.all([
        getReviewsForProductPage(productId, { id: userId, role: viewerRole }),
        getReviewEligibilityForProduct(userId, productId, orderId),
      ]);
      return { productId, reviews, eligibility };
    }),
  );

  const reviewsByProductId: Record<string, ProductReview[]> = {};
  const eligibilityByProductId: Record<string, ReviewEligibilityResult> = {};
  for (const { productId, reviews, eligibility } of entries) {
    reviewsByProductId[productId] = reviews;
    eligibilityByProductId[productId] = eligibility;
  }
  return { reviewsByProductId, eligibilityByProductId };
}
