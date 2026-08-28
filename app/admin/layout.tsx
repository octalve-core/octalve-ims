import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getAdminCounts } from "@/lib/server/admin-counts";
import { AdminShellSsrMerge } from "@/components/layouts/AdminShellSsrMerge";
import AppShell from "@/components/layouts/AppShell";

/**
 * Admin route layout — SSR sidebar counts so badges render without client
 * fetch flash (REQ-0025). Renders AppShell here (not per-page) because every
 * page under /admin/* passes `embedInAdmin` to its shared Page component,
 * which then skips wrapping itself in AppShell — this is the one place that
 * wrap needs to happen instead.
 */
export const dynamic = "force-dynamic";

export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) {
    redirect("/login");
  }
  const initialAdminCounts = await getAdminCounts(user.id);
  return (
    <AdminShellSsrMerge initialAdminCounts={initialAdminCounts}>
      <AppShell>{children}</AppShell>
    </AdminShellSsrMerge>
  );
}
