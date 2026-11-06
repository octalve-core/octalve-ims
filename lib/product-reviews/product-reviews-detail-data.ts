/**
 * SSR product reviews + eligibility for detail pages (REQ-0026).
 * Mirrors GET /api/product-reviews/by-product and /api/product-reviews/eligibility.
 * REQ-0202 — reviewerEmail densify (parity with review detail).
 */
import { prisma } from "@/prisma/client";
import {
  getReviewsByProductId,
  getEligibleReviewSlots,
} from "@/prisma/product-review";
import { resolvePublicReviewStatus } from "@/lib/product-reviews/resolve-public-review-status";
import type { ProductReview, ReviewEligibilitySlot } from "@/types";

function transformReview(
  r: Awaited<ReturnType<typeof getReviewsByProductId>>[number],
  reviewer?: {
    name: string | null;
    email: string;
    image: string | null;
  } | null,
): ProductReview {
  return {
    id: r.id,
    productId: r.productId,
    userId: r.userId,
    orderId: r.orderId,
    orderItemId: r.orderItemId ?? null,
    productName: r.productName,
    productSku: r.productSku,
    rating: r.rating,
    comment: r.comment,
    status: r.status as ProductReview["status"],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
    reviewerName: reviewer?.name ?? undefined,
    reviewerEmail: reviewer?.email ?? undefined,
    reviewerImage: reviewer?.image ?? undefined,
  };
}

export type ReviewEligibilityResult = {
  eligible: boolean;
  slots: ReviewEligibilitySlot[];
};

/**
 * Reviews for product detail display, scoped to what this viewer may see.
 * ISS-0049 — this used to always request status "all" regardless of who
 * was looking, the SSR equivalent of the exact hole ISS-0023 closed on the
 * client-fetched /api/product-reviews/by-product route: every visitor saw
 * every other buyer's pending/rejected reviews, reviewer email included.
 * Only the product's own owner or an admin may see anything but approved.
 */
export async function getReviewsForProductPage(
  productId: string,
  viewer: { id: string; role: string | null } | null,
): Promise<ProductReview[]> {
  const status = await resolvePublicReviewStatus("all", productId, viewer);
  const reviews = await getReviewsByProductId(productId, { status });
  const userIds = [...new Set(reviews.map((r) => r.userId))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return reviews.map((r) => transformReview(r, userMap.get(r.userId) ?? null));
}

/** Eligibility slots for the current user to review a product. */
export async function getReviewEligibilityForProduct(
  userId: string,
  productId: string,
  orderId?: string,
): Promise<ReviewEligibilityResult> {
  let slots = await getEligibleReviewSlots(userId, productId);
  if (orderId) {
    slots = slots.filter((s) => s.orderId === orderId);
  }
  return {
    eligible: slots.length > 0,
    slots: slots.map((s) => ({
      orderId: s.orderId,
      orderItemId: s.orderItemId,
    })),
  };
}
