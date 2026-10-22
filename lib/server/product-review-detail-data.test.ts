import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import { getProductReviewDetailForPage } from "./product-review-detail-data";

/**
 * ISS-0023 — getProductReviewDetailForPage had the ownership check
 * inverted: admin was the ONLY role gated by product ownership, while
 * every other role (including an unrelated client) got unconditional
 * access to any review's full detail (reviewer email, order total/status
 * included). These prove the fixed policy: author, admin, and the
 * product's owner can view a review; an unrelated client cannot.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "getProductReviewDetailForPage (ISS-0023)",
  () => {
    const stamp = Date.now();
    let categoryId: string;
    let productId: string;
    let reviewId: string;
    const ownerUserId = `iss-0023-owner-${stamp}`;
    const authorUserId = `iss-0023-author-${stamp}`;

    beforeAll(async () => {
      const category = await prisma.category.create({
        data: {
          name: `ISS-0023 test category ${stamp}`,
          userId: "test-user",
          createdBy: "test-user",
        },
      });
      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          name: "ISS-0023 test product",
          price: 10,
          quantity: 5,
          sku: `iss-0023-${stamp}`,
          status: "active",
          userId: ownerUserId,
          createdBy: ownerUserId,
          categoryId,
          supplierId: "test-supplier",
        },
      });
      productId = product.id;

      const review = await prisma.productReview.create({
        data: {
          productId,
          userId: authorUserId,
          productName: "ISS-0023 test product",
          rating: 5,
          comment: "Great product",
          status: "approved",
        },
      });
      reviewId = review.id;
    });

    afterAll(async () => {
      await prisma.productReview.deleteMany({ where: { id: reviewId } });
      await prisma.product.delete({ where: { id: productId } });
      await prisma.category.delete({ where: { id: categoryId } });
    });

    it("lets the author view their own review", async () => {
      const result = await getProductReviewDetailForPage(
        { id: authorUserId, role: "client" },
        reviewId,
      );
      expect(result).not.toBeNull();
    });

    it("lets admin view any review (not just ones on products they own)", async () => {
      const result = await getProductReviewDetailForPage(
        { id: "some-other-admin", role: "admin" },
        reviewId,
      );
      expect(result).not.toBeNull();
    });

    it("lets the product owner view reviews on their own products", async () => {
      const result = await getProductReviewDetailForPage(
        { id: ownerUserId, role: "user" },
        reviewId,
      );
      expect(result).not.toBeNull();
    });

    it("denies an unrelated client with no relationship to the review", async () => {
      const result = await getProductReviewDetailForPage(
        { id: "unrelated-client", role: "client" },
        reviewId,
      );
      expect(result).toBeNull();
    });
  },
);
