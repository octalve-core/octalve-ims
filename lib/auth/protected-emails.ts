/**
 * Demo/seed accounts (lib/auth/demo-seed-users.ts) that must survive every environment, so
 * admin User Management never lets anyone suspend, delete or edit them away. Previously
 * duplicated as a local const in AdminUserManagementDetailContent.tsx and
 * UserManagementTableColumns.tsx with no server-side check at all — PUT/DELETE
 * /api/users/[id] enforced nothing, so a crafted request could suspend or delete a protected
 * account even though the UI hid the button (ISS-0102).
 */
export const PROTECTED_EMAILS = [
  "test@admin.com",
  "test@supplier.com",
  "test@client.com",
];

export function isProtectedEmail(email: string | null | undefined): boolean {
  return PROTECTED_EMAILS.includes((email ?? "").toLowerCase());
}
