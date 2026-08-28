import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getDashboardForAdmin } from "@/lib/server/dashboard-data";
import AdminDashboardMergedView from "@/components/admin/AdminDashboardMergedView";

/**
 * Store Dashboard & Analytics — blocking SSR (REQ-0025, no Suspense flash).
 * Pro tier variant (identical to the Core variant) — no AI demand
 * forecasting (lib/forecasting is premium-only). Picked by
 * scripts/export-tier.ts in place of the default file when exporting Pro.
 * Keep in sync with page.core.tsx — export-tier.ts does exact-tier
 * matching only, no cross-tier fallback.
 */
export const dynamic = "force-dynamic";

export default async function StoreDashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const initialStats = await getDashboardForAdmin(user.id);

  return <AdminDashboardMergedView variant="store" initialStats={initialStats} />;
}
