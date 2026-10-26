/**
 * User.status (plain string column, matching this schema's convention for role-like fields —
 * see the `role` field in prisma/schema/tenancy.prisma; this codebase has no Prisma enums).
 *
 * - ACTIVE: normal. Login and refresh proceed.
 * - SUSPENDED: an admin action. Login and refresh both refuse it; refresh also revokes the
 *   whole refresh-token family, so an already-open tab is signed out too.
 * - PENDING_VERIFICATION: a self-registered account that has not yet followed its emailed
 *   verification link. Login refuses it with a specific message; refresh never sees it in
 *   practice, since register issues no session for a pending account — checked defensively
 *   anyway in case status is ever reverted.
 *
 * OAuth sign-ups and admin-created accounts (app/api/auth/oauth/google/callback/route.ts,
 * prisma/user-admin.ts) start ACTIVE: the provider or the admin already vouches for the email,
 * so neither goes through the self-registration verification gate.
 */
export const ACCOUNT_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
} as const;

export type UserAccountStatus =
  (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];
