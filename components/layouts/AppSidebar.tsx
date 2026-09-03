"use client";

/**
 * Persistent left sidebar shown to every role (admin/user, client, supplier).
 * Admin/user gets the grouped, count-badged catalog of ADMIN_MY_STORE_ITEMS /
 * ADMIN_MANAGEMENT_ITEMS / ADMIN_MY_ACTIVITY_ITEMS (lib/navigation/admin-nav-config.ts);
 * client/supplier get their existing flat lists from role-nav-config.ts (the
 * same source the Quick Access grid tiles read from — kept untouched so both
 * stay in sync).
 *
 * REQ-0231 — Suite Portal reskin: desktop rail is always the dark navy
 * (#000A16) sidebar from octalve-suite-portal's WorkspaceSidebar, regardless
 * of the app's light/dark theme (that source has no theme toggle at all —
 * its sidebar is a fixed color). The collapse/expand rail toggle is IMS's
 * own existing feature with no Suite Portal counterpart, kept as-is. Mobile
 * replaces the old slide-in drawer with Suite Portal's floating bottom
 * tab bar + "More" sheet (WorkspaceMobileNav) — a real navigation-model
 * change, not a new feature, since the source has no comparable drawer.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  Package,
  Warehouse,
  ShoppingCart,
  History,
  MessageSquare,
  Star,
  Store,
  Truck,
  Users,
  Mail,
  FileText,
  FolderTree,
  BarChart3,
  UserCircle,
  LogOut,
  Sparkles,
  MoreHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminCounts } from "@/hooks/queries/use-admin-counts";
import { isDataSlotUnsettled } from "@/lib/react-query";
import { DataSlotPulse } from "@/components/shared/DataSlotPulse";
import { useShellSsr } from "@/contexts/shell-ssr-context";
import {
  ADMIN_MANAGEMENT_ITEMS,
  ADMIN_MY_ACTIVITY_ITEMS,
  ADMIN_MY_STORE_ITEMS,
  ADMIN_SETTINGS_EMAIL_HREF,
  type AdminNavItemConfig,
} from "@/lib/navigation/admin-nav-config";
import { getNavItemsForRole, type RoleNavItem } from "@/lib/navigation/role-nav-config";
import { getFlatNavForRole } from "@/lib/navigation/flat-nav-for-role";
import { isNavPathActive } from "@/lib/navigation/is-nav-path-active";

const ADMIN_NAV_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/admin/dashboard-overall-insights": LayoutDashboard,
  "/business-insights": BarChart3,
  "/admin/orders": ShoppingCart,
  "/admin/invoices": FileText,
  "/admin/support-tickets": MessageSquare,
  "/admin/product-reviews": Star,
  "/admin/products": Package,
  "/categories": FolderTree,
  "/suppliers": Truck,
  "/admin/warehouses": Warehouse,
  "/admin/supplier-portal": Truck,
  "/admin/client-portal": Store,
  "/admin/user-management": Users,
  "/admin/activity-history": History,
  "/admin/my-activity": UserCircle,
  [ADMIN_SETTINGS_EMAIL_HREF]: Mail,
};

const ROLE_NAV_ICONS: Record<string, LucideIcon> = {
  "Client Portal": Store,
  "Supplier Portal": Truck,
  "Browse Products": Package,
  "My Products": Package,
  Products: Package,
  Orders: ShoppingCart,
  "My Orders": ShoppingCart,
  "View Orders": ShoppingCart,
  Invoices: FileText,
  "My Invoices": FileText,
  "Related Invoices": FileText,
};

/** One flattened nav row — shared shape between the grouped desktop rail and the flat mobile bar. */
type FlatNavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  count?: number;
  countLoading?: boolean;
};

function sidebarLinkClass(
  isActive: boolean,
  { collapsed = false }: { collapsed?: boolean } = {},
): string {
  return cn(
    "group relative flex min-h-[46px] items-center gap-3 rounded-2xl text-[13.5px] font-semibold transition-colors",
    collapsed ? "justify-center w-10 h-10 mx-auto px-0" : "px-3",
    isActive
      ? "bg-[hsl(var(--sidebar-ink-active))]/72 text-white ring-1 ring-white/5"
      : "text-white/80 hover:bg-white/[0.055] hover:text-white",
  );
}

type SidebarNavLinkProps = {
  href: string;
  label: string;
  Icon: LucideIcon;
  isActive: boolean;
  collapsed?: boolean;
  count?: number;
  countLoading?: boolean;
  onNavigate?: () => void;
};

function SidebarNavLink({
  href,
  label,
  Icon,
  isActive,
  collapsed,
  count,
  countLoading,
  onNavigate,
}: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      prefetch
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={sidebarLinkClass(isActive, { collapsed })}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] flex-shrink-0 transition-colors",
          isActive ? "text-[#5ea1ff]" : "text-white/65 group-hover:text-white",
        )}
      />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && count != null && (
        <span
          className={cn(
            "flex-shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold min-w-[1.4rem] text-center bg-[hsl(var(--sidebar-ink-badge))] text-white",
          )}
        >
          {countLoading ? (
            <DataSlotPulse variant="badge" className="mx-auto" />
          ) : count > 99 ? (
            "99+"
          ) : (
            count
          )}
        </span>
      )}
    </Link>
  );
}

function GroupLabel({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) {
  if (collapsed) return <div className="my-1 w-6 border-t border-white/10" />;
  return (
    <p className="px-3 pt-4 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-white/35">
      {children}
    </p>
  );
}

export interface AppSidebarProps {
  role: string;
  collapsed?: boolean;
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

export default function AppSidebar({
  role,
  collapsed = false,
  onLogout,
  isLoggingOut,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { initialAdminCounts } = useShellSsr();
  const isPortalRole = role === "client" || role === "supplier";
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const countsQuery = useAdminCounts(isPortalRole ? undefined : initialAdminCounts);
  const counts = countsQuery.data ?? initialAdminCounts;
  const countsLoading = !isPortalRole && isDataSlotUnsettled(countsQuery, initialAdminCounts);
  const getCount = (key: AdminNavItemConfig["countKey"]): number | undefined =>
    !counts || !key ? undefined : counts[key];

  // Close the mobile "more" sheet on route change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting sheet state on navigation, not deriving render output
    setMoreSheetOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const renderAdminGroup = (items: AdminNavItemConfig[]) =>
    items.map((item) => (
      <SidebarNavLink
        key={item.href}
        href={item.href}
        label={item.label}
        Icon={ADMIN_NAV_ICONS[item.href] ?? Package}
        isActive={isNavPathActive(pathname, item.href)}
        collapsed={collapsed}
        count={getCount(item.countKey)}
        countLoading={countsLoading && item.countKey != null}
      />
    ));

  const renderPortalItems = (items: RoleNavItem[]) =>
    items.map((item) => (
      <SidebarNavLink
        key={item.path}
        href={item.path}
        label={item.label}
        Icon={ROLE_NAV_ICONS[item.label] ?? Package}
        isActive={isNavPathActive(pathname, item.path)}
        collapsed={collapsed}
      />
    ));

  // Flat nav list — same items as the grouped desktop rail, used for the
  // mobile bottom bar's "first 3 + everything else in More" split.
  const flatNav: FlatNavItem[] = getFlatNavForRole(role).map((item) => ({
    href: item.href,
    label: item.label,
    Icon: (isPortalRole ? ROLE_NAV_ICONS[item.label] : ADMIN_NAV_ICONS[item.href]) ?? Package,
    count: isPortalRole ? undefined : getCount(
      [...ADMIN_MY_STORE_ITEMS, ...ADMIN_MANAGEMENT_ITEMS, ...ADMIN_MY_ACTIVITY_ITEMS].find(
        (adminItem) => adminItem.href === item.href,
      )?.countKey,
    ),
    countLoading:
      !isPortalRole &&
      countsLoading &&
      [...ADMIN_MY_STORE_ITEMS, ...ADMIN_MANAGEMENT_ITEMS, ...ADMIN_MY_ACTIVITY_ITEMS].some(
        (adminItem) => adminItem.href === item.href && adminItem.countKey != null,
      ),
  }));

  const primaryNav = flatNav.slice(0, 3);
  const moreNav = flatNav.slice(3);
  const moreActive = moreSheetOpen || moreNav.some((item) => isNavPathActive(pathname, item.href));

  const body = isPortalRole ? (
    <nav className={cn("flex flex-col gap-1", collapsed ? "items-center px-2" : "px-1")}>
      {renderPortalItems(getNavItemsForRole(role))}
    </nav>
  ) : (
    <nav className={cn("flex flex-col gap-1", collapsed ? "items-center px-2" : "px-1")}>
      <GroupLabel collapsed={collapsed}>My Store</GroupLabel>
      {renderAdminGroup(ADMIN_MY_STORE_ITEMS)}
      <GroupLabel collapsed={collapsed}>Management</GroupLabel>
      {renderAdminGroup(ADMIN_MANAGEMENT_ITEMS)}
      <GroupLabel collapsed={collapsed}>My Activity</GroupLabel>
      {renderAdminGroup(ADMIN_MY_ACTIVITY_ITEMS)}
      <GroupLabel collapsed={collapsed}>Settings</GroupLabel>
      <SidebarNavLink
        href={ADMIN_SETTINGS_EMAIL_HREF}
        label="Email Preferences"
        Icon={Mail}
        isActive={isNavPathActive(pathname, ADMIN_SETTINGS_EMAIL_HREF)}
        collapsed={collapsed}
      />
    </nav>
  );

  const footer = !collapsed && (
    <div className="mt-auto flex flex-col gap-3 px-1 pt-4">
      <div className="flex flex-col gap-2 rounded-[20px] border border-white/10 bg-white/[0.035] p-3.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0064E0]">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <p className="text-xs font-semibold text-white">Unlock Pro features</p>
        <p className="text-[11px] leading-relaxed text-white/55">
          Multi-warehouse allocation, AI demand forecasting, and stock reviews.
        </p>
        <button
          type="button"
          className="mt-0.5 cursor-pointer rounded-lg bg-[#0064E0] px-2 py-1.5 text-xs font-semibold text-white"
        >
          Upgrade to Pro
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.035] p-3">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[#0A2447] text-sm font-bold text-white ring-1 ring-[#0064E0]">
          {role.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[13.5px] font-semibold text-white">
            {role === "client" ? "Client" : role === "supplier" ? "Supplier" : "Store Owner"}
          </strong>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          aria-label="Log out"
          title="Log Out"
          className="grid h-10 w-10 flex-shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-white/[0.025] text-white/70 transition hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-[17px] w-[17px]" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar (full or collapsed rail) — always the dark navy skin */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-shrink-0 flex-col overflow-y-auto bg-[hsl(var(--sidebar-ink))] py-5 sm:flex",
          collapsed ? "w-[76px] px-3" : "w-[260px] px-4",
        )}
        aria-label="Primary navigation"
      >
        <div className={cn("flex h-11 items-center gap-2.5 pb-6", collapsed ? "justify-center" : "px-1")}>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#0064E0] text-xl font-bold text-white">
            O
          </div>
          {!collapsed && <span className="text-2xl font-bold tracking-tight text-white">Octalve IMS</span>}
        </div>
        {body}
        {footer}
        {collapsed && (
          <div className="pt-3">
            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              title="Log Out"
              className="mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl text-white/60 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-[17px] w-[17px]" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile: floating bottom tab bar (first 3 nav items) + "More" sheet for the rest */}
      <nav className="fixed bottom-3 left-3 right-3 z-50 flex items-center gap-2 rounded-[26px] border border-blue-100 bg-white/95 p-2 shadow-[0_20px_50px_rgba(0,100,224,0.18)] backdrop-blur-xl sm:hidden">
        <div className="grid flex-1 grid-cols-3 gap-1">
          {primaryNav.map((item) => {
            const active = isNavPathActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition",
                  active
                    ? "bg-[#0064E0] text-white shadow-[0_10px_22px_rgba(0,100,224,0.24)]"
                    : "text-slate-600 hover:bg-blue-50 hover:text-[#0064E0]",
                )}
              >
                <item.Icon className="h-[19px] w-[19px]" />
                <span className="max-w-[68px] truncate">{item.label}</span>
                {item.count != null && item.count > 0 ? (
                  <em className="absolute right-2 top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold not-italic text-white ring-2 ring-white">
                    {item.count > 9 ? "9+" : item.count}
                  </em>
                ) : null}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setMoreSheetOpen((v) => !v)}
          aria-expanded={moreSheetOpen}
          aria-label="Open more navigation"
          className={cn(
            "flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition",
            moreActive
              ? "bg-[#0064E0] text-white shadow-[0_10px_22px_rgba(0,100,224,0.24)]"
              : "text-slate-600 hover:bg-blue-50 hover:text-[#0064E0]",
          )}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={2.25} />
          <span>More</span>
        </button>
      </nav>

      {moreSheetOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/30 sm:hidden"
            aria-label="Close more navigation"
            onClick={() => setMoreSheetOpen(false)}
          />
          <section className="fixed bottom-24 left-3 right-3 z-50 rounded-[28px] border border-blue-100 bg-white p-4 shadow-[0_26px_70px_rgba(0,100,224,0.22)] sm:hidden">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <strong className="block text-base font-semibold text-slate-950">More</strong>
                <span className="mt-1 block text-xs font-medium text-slate-500">
                  {role === "client" ? "Client" : role === "supplier" ? "Supplier" : "Store Owner"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMoreSheetOpen(false)}
                className="grid h-10 w-10 cursor-pointer place-items-center rounded-2xl bg-slate-100 text-slate-600"
                aria-label="Close more navigation"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            <div className="grid max-h-[56vh] grid-cols-2 gap-2 overflow-auto">
              {moreNav.map((item) => {
                const active = isNavPathActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreSheetOpen(false)}
                    className={cn(
                      "relative flex min-h-[52px] items-center gap-2.5 rounded-2xl border px-3 text-[13px] font-semibold",
                      active
                        ? "border-[#0064E0] bg-[#0064E0] text-white"
                        : "border-blue-100 bg-blue-50/40 text-slate-700",
                    )}
                  >
                    <item.Icon className="h-[17px] w-[17px] flex-shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.count != null && item.count > 0 ? (
                      <em className="grid min-w-5 place-items-center rounded-full bg-[#0064E0]/15 px-1.5 py-0.5 text-[10px] font-bold not-italic text-[#0064E0]">
                        {item.count > 9 ? "9+" : item.count}
                      </em>
                    ) : null}
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setMoreSheetOpen(false);
                  onLogout?.();
                }}
                disabled={isLoggingOut}
                className="col-span-2 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-[17px] w-[17px]" />
                {isLoggingOut ? "Logging Out…" : "Logout"}
              </button>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
