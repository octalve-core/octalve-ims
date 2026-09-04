import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import ForgotPasswordPage from "@/components/Pages/ForgotPasswordPage";

export const dynamic = "force-dynamic";

/**
 * Forgot-password route — server component.
 * If user is already logged in (session cookie), redirect to home.
 */
export default async function ForgotPasswordRoute() {
  const user = await getSession();
  if (user) {
    redirect("/");
  }
  return <ForgotPasswordPage />;
}
