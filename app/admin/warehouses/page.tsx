import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getWarehousesForUser } from "@/lib/server/warehouses-data";
import { prefetchListPageStats } from "@/lib/server/list-page-stats";
import AdminWarehousesContent from "@/components/admin/AdminWarehousesContent";

/**
 * REQ-0025 — blocking SSR prefetch (no Suspense shell flash) for warehouse
 * list + stats. The per-warehouse stock-allocation summary (Pro-tier,
 * multi-warehouse analytics) is intentionally NOT SSR-fetched here — it's a
 * supplementary panel, not core page content, so AdminWarehousesContent's
 * useWarehouseStockSummary hook fetches it client-side instead (tolerates
 * undefined initial data). Keeping @/prisma/stock-allocation out of this
 * Core-bucketed page is what keeps a Core-only export buildable.
 */
export const dynamic = "force-dynamic";

export default async function AdminWarehousesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [initialWarehouses, listStats] = await Promise.all([
    getWarehousesForUser(user.id),
    prefetchListPageStats(user),
  ]);
  return (
    <AdminWarehousesContent
      initialWarehouses={initialWarehouses}
      initialStats={listStats.initialStats}
    />
  );
}
