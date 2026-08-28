"use client";

/**
 * Slim top bar: sidebar collapse/mobile toggle, notifications, theme toggle,
 * avatar + name/role. Ported from the old Navbar's right-section logic — no
 * nav links here anymore, those live in AppSidebar.
 */
import React from "react";
import Link from "next/link";
import { Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SafeAvatarImage } from "@/components/ui/safe-avatar-image";
import { resolveUserAvatarSources } from "@/lib/ui/user-avatar-sources";
import { NotificationBell } from "../shared";
import { ModeToggle } from "./ModeToggle";
import {
  DROPDOWN_NAV_CONTENT_CLASS,
  DROPDOWN_NAV_ITEM_CLASS,
} from "@/components/ui/menu-item-styles";
import { PROFILE_MENU_PATHS } from "@/lib/navigation/role-nav-config";

const PROFILE_MENU_LINKS = [
  { path: PROFILE_MENU_PATHS[0], label: "Support Tickets" },
  { path: PROFILE_MENU_PATHS[1], label: "Email Preferences" },
  { path: PROFILE_MENU_PATHS[2], label: "API Documentation" },
  { path: PROFILE_MENU_PATHS[3], label: "API Status" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Store Owner",
  user: "Store Owner",
  client: "Client",
  supplier: "Supplier",
  retailer: "Retailer",
};

export interface AppTopBarProps {
  role: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export default function AppTopBar({
  role,
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
  onLogout,
  isLoggingOut,
}: AppTopBarProps) {
  const { user, isCheckingAuth } = useAuth();
  const avatar = resolveUserAvatarSources(user);

  return (
    <header className="sticky top-0 z-40 flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-background px-3 sm:px-5">
      {/* Skip to main content — visible on focus (WCAG 2.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-normal focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Desktop collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-9 w-9 sm:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        ) : (
          <PanelLeftClose className="h-[18px] w-[18px]" />
        )}
      </Button>

      {/* Mobile drawer toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenMobile}
        aria-label="Open navigation"
        className="h-9 w-9 sm:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </Button>

      <div className="min-w-0 flex-1" />

      <div className="flex items-center gap-1.5 sm:gap-2">
        {isCheckingAuth ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-secondary sm:h-9 sm:w-9" />
        ) : user ? (
          <NotificationBell />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" />
        )}

        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              aria-label="Open account menu"
              className="flex h-auto items-center gap-2 rounded-lg px-1.5 py-1 sm:pl-1 sm:pr-2.5"
            >
              <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary sm:h-9 sm:w-9">
                {isCheckingAuth ? (
                  <span className="h-full w-full animate-pulse bg-secondary" />
                ) : avatar ? (
                  <SafeAvatarImage
                    src={avatar.src}
                    fallbackSrc={avatar.fallbackSrc}
                    alt={user?.name || "User"}
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                    priority
                  />
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {user?.email?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </span>
              <span className="hidden flex-col items-start leading-tight sm:flex">
                <span className="max-w-[9rem] truncate text-[12.5px] font-semibold">
                  {isCheckingAuth ? "…" : user?.name || user?.email}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {ROLE_LABELS[role] ?? "Member"}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`w-56 ${DROPDOWN_NAV_CONTENT_CLASS}`}>
            <DropdownMenuLabel className="px-2 py-2 font-normal">
              <div className="flex flex-col">
                {user?.name && <p className="text-sm leading-none">{user.name}</p>}
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PROFILE_MENU_LINKS.map(({ path, label }) => (
              <DropdownMenuItem key={path} asChild className={DROPDOWN_NAV_ITEM_CLASS}>
                <Link href={path} prefetch>
                  <span>{label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onLogout}
              disabled={isLoggingOut}
              className={DROPDOWN_NAV_ITEM_CLASS}
            >
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive">
                {isLoggingOut ? "Logging Out…" : "Logout"}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
