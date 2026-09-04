import ResetPasswordPage from "@/components/Pages/ResetPasswordPage";

export const dynamic = "force-dynamic";

/**
 * Reset-password route — server component.
 * Unlike /login and /forgot-password, an existing session doesn't redirect
 * away: the emailed token is independent of whatever session the browser
 * currently holds, and resetting revokes every active session anyway.
 */
export default function ResetPasswordRoute() {
  return <ResetPasswordPage />;
}
