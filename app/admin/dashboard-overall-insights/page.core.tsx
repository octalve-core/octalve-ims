import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getDashboardForAdmin } from "@/lib/server/dashboard-data";
import AdminDashboardMergedView from "@/components/admin/AdminDashboardMergedView";

/**
 * Store Dashboard & Analytics — blocking SSR (REQ-0025, no Suspense flash).
 * Core tier variant — no AI demand forecasting (lib/forecasting is
 * premium-only). Picked by scripts/export-tier.ts in place of the default
 * file when exporting Core (see page.pro.tsx for the identical Pro
 * variant — forecasting is premium-exclusive, so Pro needs the same drop).
 */
export const dynamic = "force-dynamic";

export default async function StoreDashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const initialStats = await getDashboardForAdmin(user.id);

  return <AdminDashboardMergedView variant="store" initialStats={initialStats} />;
}
