import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0049 — getReviewsForProductPage used to always request status "all"
 * regardless of who was looking, the SSR equivalent of the hole ISS-0023
 * closed on the client-fetched route. Proves it now delegates to the same
 * viewer-scoped resolver instead of hardcoding "all".
 */

const { resolvePublicReviewStatus, getReviewsByProductId, userFindMany } = vi.hoisted(() => ({
  resolvePublicReviewStatus: vi.fn(),
  getReviewsByProductId: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/product-reviews/resolve-public-review-status", () => ({
  resolvePublicReviewStatus,
}));
vi.mock("@/prisma/product-review", () => ({
  getReviewsByProductId,
  getEligibleReviewSlots: vi.fn(),
}));
vi.mock("@/prisma/client", () => ({
  prisma: { user: { findMany: userFindMany } },
}));

import { getReviewsForProductPage } from "./product-reviews-detail-data";

beforeEach(() => {
  vi.clearAllMocks();
  getReviewsByProductId.mockResolvedValue([]);
  userFindMany.mockResolvedValue([]);
});

describe("getReviewsForProductPage", () => {
  it("asks the shared resolver for 'all', scoped by the given viewer, instead of requesting it directly", async () => {
    resolvePublicReviewStatus.mockResolvedValue("approved");
    await getReviewsForProductPage("p1", { id: "attacker", role: "user" });
    expect(resolvePublicReviewStatus).toHaveBeenCalledWith(
      "all",
      "p1",
      { id: "attacker", role: "user" },
    );
    expect(getReviewsByProductId).toHaveBeenCalledWith("p1", { status: "approved" });
  });

  it("passes a null viewer straight through to the resolver (public/anonymous caller)", async () => {
    resolvePublicReviewStatus.mockResolvedValue("approved");
    await getReviewsForProductPage("p1", null);
    expect(resolvePublicReviewStatus).toHaveBeenCalledWith("all", "p1", null);
  });

  it("the product owner's viewer resolves to 'all' via the resolver, and that's what reaches the query", async () => {
    resolvePublicReviewStatus.mockResolvedValue("all");
    await getReviewsForProductPage("p1", { id: "owner", role: "user" });
    expect(getReviewsByProductId).toHaveBeenCalledWith("p1", { status: "all" });
  });
});
