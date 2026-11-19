import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import { resolvePublicReviewStatus } from "./resolve-public-review-status";

/**
 * ISS-0023 — the public by-product reviews route used to pass
 * ?status=all/?status=pending straight through with no session check at
 * all, letting any anonymous visitor see unmoderated reviews. Proves only
 * the product's own owner or admin can get anything but "approved".
 */
describe.skipIf(!process.env.DATABASE_URL)("resolvePublicReviewStatus (ISS-0023)", () => {
  const stamp = Date.now();
  let categoryId: string;
  let productId: string;
  const ownerUserId = `iss-0023-owner-${stamp}`;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `ISS-0023 status test category ${stamp}`,
        userId: "test-user",
        createdBy: "test-user",
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: "ISS-0023 status test product",
        price: 10,
        quantity: 5,
        sku: `iss-0023-status-${stamp}`,
        status: "active",
        userId: ownerUserId,
        createdBy: ownerUserId,
        categoryId,
        supplierId: "test-supplier",
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  it("always returns approved for an anonymous caller, regardless of requested status", async () => {
    expect(await resolvePublicReviewStatus("all", productId, null)).toBe("approved");
    expect(await resolvePublicReviewStatus("pending", productId, null)).toBe("approved");
  });

  it("falls back to approved for an unrelated logged-in client requesting pending/all", async () => {
    const result = await resolvePublicReviewStatus("all", productId, {
      id: "unrelated-client",
      role: "client",
    });
    expect(result).toBe("approved");
  });

  it("honors the requested status for the product's own owner", async () => {
    const result = await resolvePublicReviewStatus("all", productId, {
      id: ownerUserId,
      role: "user",
    });
    expect(result).toBe("all");
  });

  it("honors the requested status for admin", async () => {
    const result = await resolvePublicReviewStatus("pending", productId, {
      id: "some-admin",
      role: "admin",
    });
    expect(result).toBe("pending");
  });

  it("ignores an unrecognized status value and defaults to approved", async () => {
    const result = await resolvePublicReviewStatus(
      "rejected" as never,
      productId,
      { id: ownerUserId, role: "user" },
    );
    expect(result).toBe("approved");
  });
});
