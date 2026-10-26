import VerifyEmailPage from "@/components/Pages/VerifyEmailPage";

export const dynamic = "force-dynamic";

/**
 * Verify-email route — server component.
 * No session redirect, same reasoning as /reset-password: the emailed token is independent
 * of whatever session the browser currently holds.
 */
export default function VerifyEmailRoute() {
  return <VerifyEmailPage />;
}
