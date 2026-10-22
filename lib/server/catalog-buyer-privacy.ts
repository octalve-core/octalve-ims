/**
 * ISS-0018 — product/category/supplier detail pages show a "recently
 * ordered" list for fulfillment/analytics (who's buying this), which
 * embedded each order's buyer name/email unconditionally. A client is
 * another customer browsing the catalog — they have no legitimate reason
 * to see a different buyer's identity, so it's redacted for that role only;
 * admin/supplier/owner staff keep seeing it.
 */
import type { SessionForDetail } from "@/lib/server/order-detail-data";

export function redactBuyerForViewer<
  T extends { id: string; name: string | null; email: string; image?: string | null } | null,
>(party: T, session: SessionForDetail): T | null {
  if (session.role === "client") return null;
  return party;
}
