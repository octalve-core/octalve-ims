import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import ChangePasswordPage from "@/components/Pages/ChangePasswordPage";

export const dynamic = "force-dynamic";

export default async function ChangePasswordRoute() {
  const user = await getSession();
  if (!user) redirect("/login");

  return <ChangePasswordPage />;
}
