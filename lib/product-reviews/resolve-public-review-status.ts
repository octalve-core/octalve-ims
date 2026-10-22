/**
 * ISS-0023 — the public by-product reviews route has no session check (it's
 * the product-page reviews list), but used to pass a `?status=all`/
 * `?status=pending` query param straight through: anyone, logged in or
 * not, could see unmoderated reviews (reviewer email included) before
 * they're approved. Only the product's own owner or admin may ask for
 * anything other than the public "approved" default.
 */
import { prisma } from "@/prisma/client";

export type ReviewStatusFilter = "approved" | "pending" | "all";

export async function resolvePublicReviewStatus(
  requestedStatus: ReviewStatusFilter | null,
  productId: string,
  session: { id: string; role: string | null } | null,
): Promise<ReviewStatusFilter> {
  if (requestedStatus !== "all" && requestedStatus !== "pending") {
    return "approved";
  }
  if (!session) return "approved";

  const isAdmin = session.role === "admin";
  if (isAdmin) return requestedStatus;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { userId: true },
  });
  return product?.userId === session.id ? requestedStatus : "approved";
}
