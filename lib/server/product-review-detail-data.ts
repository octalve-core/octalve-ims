/**
 * Server-side product review detail fetch for SSR prefetch.
 * Mirrors GET /api/product-reviews/:id auth + response shape.
 * REQ-0024 / REQ-0180
 */

import { prisma } from "@/prisma/client";
import { getProductReviewById } from "@/prisma/product-review";
import { transformProductReviewDetail } from "@/lib/product-reviews/transform-product-review-detail";
import {
  loadReviewCatalogByProductId,
  loadReviewPurchaseEnrich,
  loadReviewerMap,
} from "@/lib/product-reviews/enrich-review-catalog";
import type { ProductReview } from "@/types";
import type { SessionForDetail } from "@/lib/server/order-detail-data";

export type ProductReviewDetailForPage = ProductReview;

/** Role-scoped product review detail for page SSR — null when not found or unauthorized. */
export async function getProductReviewDetailForPage(
  session: SessionForDetail,
  id: string,
): Promise<ProductReviewDetailForPage | null> {
  const record = await getProductReviewById(id);
  if (!record) return null;

  // ISS-0023 — this was inverted: admin (who should see every review
  // under the single-tenant model, as PUT/DELETE on this same resource
  // already correctly allow) was the ONLY role gated by product
  // ownership, while every other role — including a client with no
  // relationship to the review at all — got unconditional access,
  // reviewer email and order total/status included.
  const isAuthor = record.userId === session.id;
  const isAdmin = session.role === "admin";
  if (!isAuthor && !isAdmin) {
    const product = await prisma.product.findUnique({
      where: { id: record.productId },
      select: { userId: true },
    });
    if (product?.userId !== session.id) return null;
  }

  const [reviewerMap, catalogMap, purchase] = await Promise.all([
    loadReviewerMap([record.userId]),
    loadReviewCatalogByProductId([record.productId]),
    loadReviewPurchaseEnrich(record.orderId),
  ]);

  const reviewer = reviewerMap.get(record.userId) ?? null;
  const catalog = catalogMap.get(record.productId) ?? null;

  return transformProductReviewDetail(record, reviewer, catalog, purchase);
}
