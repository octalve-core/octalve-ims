"use client";

/**
 * Persistent left sidebar shown to every role (admin/user, client, supplier).
 * Admin/user gets the grouped, count-badged catalog of ADMIN_MY_STORE_ITEMS /
 * ADMIN_MANAGEMENT_ITEMS / ADMIN_MY_ACTIVITY_ITEMS (lib/navigation/admin-nav-config.ts);
 * client/supplier get their existing flat lists from role-nav-config.ts (the
 * same source the Quick Access grid tiles read from — kept untouched so both
 * stay in sync).
 */
import React, { useEffect } from "react";
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

function sidebarLinkClass(
  isActive: boolean,
  { collapsed = false }: { collapsed?: boolean } = {},
): string {
  return cn(
    "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
    collapsed ? "justify-center w-9 h-9 mx-auto px-0" : "px-3 py-2",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
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
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Icon className="h-[17px] w-[17px] flex-shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && count != null && (
        <span
          className={cn(
            "flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold min-w-[1.25rem] text-center",
            isActive
              ? "bg-primary/15 text-primary"
              : "bg-secondary text-muted-foreground",
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
  if (collapsed) return <div className="my-1 w-6 border-t border-border" />;
  return (
    <p className="px-3 pt-4 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

export interface AppSidebarProps {
  role: string;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

export default function AppSidebar({
  role,
  collapsed = false,
  mobileOpen = false,
  onCloseMobile,
  onLogout,
  isLoggingOut,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { initialAdminCounts } = useShellSsr();
  const isPortalRole = role === "client" || role === "supplier";

  const countsQuery = useAdminCounts(isPortalRole ? undefined : initialAdminCounts);
  const counts = countsQuery.data ?? initialAdminCounts;
  const countsLoading = !isPortalRole && isDataSlotUnsettled(countsQuery, initialAdminCounts);
  const getCount = (key: AdminNavItemConfig["countKey"]): number | undefined =>
    !counts || !key ? undefined : counts[key];

  // Close the mobile drawer on route change.
  useEffect(() => {
    onCloseMobile?.();
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
        onNavigate={onCloseMobile}
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
        onNavigate={onCloseMobile}
      />
    ));

  const body = isPortalRole ? (
    <nav className={cn("flex flex-col gap-1", collapsed ? "items-center px-2" : "p-2")}>
      {renderPortalItems(getNavItemsForRole(role))}
    </nav>
  ) : (
    <nav className={cn("flex flex-col gap-1", collapsed ? "items-center px-2" : "p-2")}>
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
        onNavigate={onCloseMobile}
      />
    </nav>
  );

  const footer = !collapsed && (
    <div className="mt-auto flex flex-col gap-2 p-2">
      <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <p className="text-xs font-semibold">Unlock Pro features</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Multi-warehouse allocation, AI demand forecasting, and stock reviews.
        </p>
        <button
          type="button"
          className="mt-0.5 rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Upgrade to Pro
        </button>
      </div>
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        onClick={onLogout}
        disabled={isLoggingOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
      >
        <LogOut className="h-[17px] w-[17px] flex-shrink-0" />
        {isLoggingOut ? "Logging Out…" : "Log Out"}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar (full or collapsed rail) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-card sm:flex",
          collapsed ? "w-[68px]" : "w-64",
        )}
        aria-label="Primary navigation"
      >
        <div className={cn("flex h-16 items-center gap-2 border-b border-border", collapsed ? "justify-center px-2" : "px-4")}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            O
          </div>
          {!collapsed && <span className="text-[15px] font-semibold tracking-tight">Octalve IMS</span>}
        </div>
        {body}
        {footer}
        {collapsed && (
          <div className="p-2">
            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              title="Log Out"
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <LogOut className="h-[17px] w-[17px]" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
          >
            <div className="flex h-16 items-center gap-2 border-b border-border px-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                O
              </div>
              <span className="text-[15px] font-semibold tracking-tight">Octalve IMS</span>
            </div>
            {body}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
