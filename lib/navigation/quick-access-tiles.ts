/**
 * Icon + color lookup for the dashboard "quick access" module grid.
 * Content (which modules, per role) is sourced from role-nav-config.ts —
 * this file only decorates that existing curated list with a lucide icon
 * and a GlassCard tone. Reuses established entity hues where they already
 * exist elsewhere (category=sky, supplier=emerald, warehouse=cyan, per
 * lib/ui/catalog-filter-tokens.ts) instead of inventing new ones.
 */
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  FolderTree,
  Truck,
  Warehouse,
  BarChart3,
  Settings,
  Store,
} from "lucide-react";
import { getNavItemsForRole } from "@/lib/navigation/role-nav-config";
import type { GlassCardVariant } from "@/lib/ui/glass-card";

export type QuickAccessTile = {
  label: string;
  path: string;
  icon: LucideIcon;
  tone: GlassCardVariant;
};

/** Keyed by nav item label — labels are role-specific (e.g. "My Orders" vs "Orders"). */
const TILE_META: Record<string, { icon: LucideIcon; tone: GlassCardVariant }> = {
  Dashboard: { icon: LayoutDashboard, tone: "rose" },
  Products: { icon: Package, tone: "violet" },
  "Browse Products": { icon: Package, tone: "violet" },
  "My Products": { icon: Package, tone: "violet" },
  Orders: { icon: ShoppingCart, tone: "blue" },
  "My Orders": { icon: ShoppingCart, tone: "blue" },
  "View Orders": { icon: ShoppingCart, tone: "blue" },
  Invoices: { icon: FileText, tone: "amber" },
  "My Invoices": { icon: FileText, tone: "amber" },
  "Related Invoices": { icon: FileText, tone: "amber" },
  Categories: { icon: FolderTree, tone: "sky" },
  Suppliers: { icon: Truck, tone: "emerald" },
  Warehouses: { icon: Warehouse, tone: "cyan" },
  "Business Insights": { icon: BarChart3, tone: "teal" },
  "Admin Panel": { icon: Settings, tone: "rose" },
  "Client Portal": { icon: Store, tone: "rose" },
  "Supplier Portal": { icon: Truck, tone: "rose" },
};

/**
 * Quick-access tiles for the given role, in the same order as the primary
 * nav (role-nav-config.ts). Items without a TILE_META entry (currently
 * none, but future nav additions may omit one deliberately) are skipped
 * rather than rendered with a placeholder icon/color.
 */
export function getQuickAccessTiles(
  role: string | null | undefined,
): QuickAccessTile[] {
  return getNavItemsForRole(role).flatMap((item) => {
    const meta = TILE_META[item.label];
    if (!meta) return [];
    return [{ label: item.label, path: item.path, icon: meta.icon, tone: meta.tone }];
  });
}
