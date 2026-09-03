"use client";

/**
 * Slim top bar: sidebar collapse toggle, global page search, notifications,
 * theme toggle, avatar + name/role.
 *
 * REQ-0231 — Suite Portal reskin adds a working global search box (ported
 * from WorkspaceTopbar's search — the source's one genuinely new piece of
 * functionality, explicitly requested rather than assumed). Scope: it
 * searches sidebar nav pages only (Suite Portal also indexes projects/
 * phases/payments, which don't have an IMS equivalent here) — typing
 * filters a dropdown of matching pages, Enter or a click navigates. The
 * old mobile "Open navigation" toggle is gone: AppSidebar's own floating
 * bottom bar covers mobile nav now, so there's nothing left for it to open.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
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
import { getFlatNavForRole } from "@/lib/navigation/flat-nav-for-role";
import { cn } from "@/lib/utils";

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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export interface AppTopBarProps {
  role: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export default function AppTopBar({
  role,
  collapsed,
  onToggleCollapsed,
  onLogout,
  isLoggingOut,
}: AppTopBarProps) {
  const { user, isCheckingAuth } = useAuth();
  const avatar = resolveUserAvatarSources(user);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const navItems = useMemo(() => getFlatNavForRole(role), [role]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (q.length < 1) return [];
    return navItems.filter((item) => normalize(item.label).includes(q)).slice(0, 8);
  }, [navItems, query]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function closeSearch() {
    setSearchOpen(false);
    setMobileSearchOpen(false);
    setQuery("");
  }

  function goTo(href: string) {
    closeSearch();
    router.push(href);
  }

  function submitSearch() {
    const first = results[0];
    if (first) goTo(first.href);
  }

  function renderResults() {
    const hasQuery = query.trim().length >= 1;
    return (
      <div className="border-t border-border bg-secondary/60 px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Search results
        </span>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex h-[66px] flex-shrink-0 items-center gap-3 border-b border-border bg-background/90 px-3 backdrop-blur-xl sm:px-5">
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
        className="hidden h-10 w-10 flex-shrink-0 rounded-2xl border border-border sm:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        ) : (
          <PanelLeftClose className="h-[18px] w-[18px]" />
        )}
      </Button>

      {/* Desktop search */}
      <div ref={searchWrapRef} className="relative hidden min-w-0 max-w-[360px] flex-1 items-center gap-3 rounded-2xl border border-border bg-background px-4 py-2 shadow-sm sm:flex">
        <Search className="h-[18px] w-[18px] flex-shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitSearch();
            if (e.key === "Escape") setSearchOpen(false);
          }}
          placeholder="Search pages…"
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />

        {searchOpen && query.trim().length >= 1 ? (
          <section className="absolute left-0 top-[calc(100%+10px)] z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
            {renderResults()}
            {results.length ? (
              <div className="max-h-[min(360px,60vh)] overflow-auto">
                {results.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeSearch}
                    className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0 hover:bg-accent"
                  >
                    <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Search className="h-[14px] w-[14px]" />
                    </span>
                    <span className="min-w-0 truncate font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid min-h-28 place-items-center px-6 py-6 text-center">
                <span className="text-sm font-medium text-muted-foreground">No matching page</span>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {/* Mobile search trigger */}
      <button
        type="button"
        onClick={() => {
          setMobileSearchOpen(true);
          setSearchOpen(true);
        }}
        aria-label="Search pages"
        className="grid h-10 w-10 flex-shrink-0 cursor-pointer place-items-center rounded-2xl border border-border bg-background text-muted-foreground shadow-sm sm:hidden"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {mobileSearchOpen ? (
        <section className="fixed left-3 right-3 top-[76px] z-50 overflow-hidden rounded-3xl border border-border bg-popover shadow-lg sm:hidden">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Search className="h-[18px] w-[18px] flex-shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
                if (e.key === "Escape") closeSearch();
              }}
              placeholder="Search pages…"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
              className="grid h-9 w-9 flex-shrink-0 cursor-pointer place-items-center rounded-xl border border-border bg-background text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {query.trim().length >= 1 ? (
            <>
              {renderResults()}
              {results.length ? (
                <div className="max-h-[min(360px,50vh)] overflow-auto">
                  {results.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeSearch}
                      className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0 hover:bg-accent"
                    >
                      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Search className="h-[14px] w-[14px]" />
                      </span>
                      <span className="min-w-0 truncate font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-28 place-items-center px-6 py-6 text-center">
                  <span className="text-sm font-medium text-muted-foreground">No matching page</span>
                </div>
              )}
            </>
          ) : null}
        </section>
      ) : null}

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
              className="flex h-auto items-center gap-2 rounded-2xl px-1.5 py-1 sm:pl-1 sm:pr-2.5"
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
