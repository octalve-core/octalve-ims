/**
 * Flattened nav rows shared by AppSidebar (mobile bottom bar's "first 3 +
 * more" split) and AppTopBar (global page search) — REQ-0231. Mirrors
 * exactly what the desktop sidebar shows (admin: My Store + Management +
 * My Activity + Settings, in that order; client/supplier: their flat list),
 * so search results and the mobile nav never drift from the sidebar itself.
 */
import {
  ADMIN_MANAGEMENT_ITEMS,
  ADMIN_MY_ACTIVITY_ITEMS,
  ADMIN_MY_STORE_ITEMS,
  ADMIN_SETTINGS_EMAIL_HREF,
} from "@/lib/navigation/admin-nav-config";
import { getNavItemsForRole } from "@/lib/navigation/role-nav-config";

export type FlatNavRow = { href: string; label: string };

export function getFlatNavForRole(role: string | null | undefined): FlatNavRow[] {
  const isPortalRole = role === "client" || role === "supplier";

  if (isPortalRole) {
    return getNavItemsForRole(role).map((item) => ({ href: item.path, label: item.label }));
  }

  return [
    ...ADMIN_MY_STORE_ITEMS,
    ...ADMIN_MANAGEMENT_ITEMS,
    ...ADMIN_MY_ACTIVITY_ITEMS,
  ]
    .map((item) => ({ href: item.href, label: item.label }))
    .concat([{ href: ADMIN_SETTINGS_EMAIL_HREF, label: "Email Preferences" }]);
}
