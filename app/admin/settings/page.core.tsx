import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import AdminSettingsContent from "@/components/admin/AdminSettingsContent";

/** Core tier — no SSR system-config prefetch, see AdminSettingsContent.core.tsx. */
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/admin");

  return <AdminSettingsContent />;
}
