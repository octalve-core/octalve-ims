"use client";

/**
 * Replaces the old Navbar as the app-shell wrapper every page imports:
 * <AppShell>{page content}</AppShell>. Composes a persistent left AppSidebar
 * (role-aware, all roles) + slim AppTopBar + scrollable content area.
 */
import React, { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { setPostLogoutGoodbye } from "@/lib/auth/post-logout-goodbye";
import { clearAuthToastMarkers } from "@/components/shared/AuthSessionToasts";
import { useToast } from "@/hooks/use-toast";
import ScrollControl from "../shared/ScrollControl";
import Footer from "./Footer";
import AppSidebar from "./AppSidebar";
import AppTopBar from "./AppTopBar";
import { APP_SHELL_WIDTH_CLASS } from "@/lib/ui/shell-layout-styles";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "octalve-sidebar-collapsed";

interface AppShellProps {
  children?: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, isCheckingAuth } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the user's collapse preference — AppShell remounts per page (no
  // centralized layout exists yet), so this is what keeps it feeling
  // persistent instead of resetting on every navigation.
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    // Deliberately deferred to an effect rather than a useState lazy
    // initializer: localStorage isn't available during SSR, so reading it
    // during render would make the client's first render diverge from the
    // server-rendered HTML (a real hydration mismatch) — one extra render
    // after mount is the correct trade-off here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setMobileOpen(false);

    try {
      const userName = user?.name || user?.email?.split("@")[0] || "User";

      clearAuthToastMarkers();
      setPostLogoutGoodbye({ userName });

      localStorage.removeItem("isAuth");
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("token");
      localStorage.removeItem("getSession");
      localStorage.removeItem("prevUserId");
      localStorage.removeItem("octalve-ims-query-cache");

      // Await the server-side logout so the httpOnly session_id cookie is
      // cleared via Set-Cookie BEFORE the browser navigates to /login.
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
      window.location.href = "/login";
      return;
    } catch {
      toast({
        title: "Logout Failed",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Role from auth when available; else infer from pathname so client/supplier
  // see correct nav on refresh (no admin-nav flash) — same convention the old
  // Navbar used.
  const role =
    user?.role ??
    (pathname?.startsWith("/client")
      ? "client"
      : pathname?.startsWith("/supplier")
        ? "supplier"
        : "user");

  if (!children) return null;

  return (
    <div className="relative flex h-screen min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),transparent_55%),radial-gradient(circle_at_bottom,_rgba(236,72,153,0.06),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),transparent_55%),radial-gradient(circle_at_bottom,_rgba(236,72,153,0.08),transparent_65%)]">
      <ScrollControl />

      <AppSidebar
        role={role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className="poppins relative z-10 flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar
          role={role}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenMobile={() => setMobileOpen(true)}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
        <main
          id="main-content"
          className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden"
          tabIndex={-1}
        >
          <div className="flex flex-1 flex-col">
            <div
              className={
                pathname?.startsWith("/admin") ||
                pathname?.startsWith("/business-insights")
                  ? `${APP_SHELL_WIDTH_CLASS} flex-1 sm:pr-4`
                  : `${APP_SHELL_WIDTH_CLASS} p-2 sm:px-4 sm:py-6 flex-1`
              }
            >
              {children}
            </div>
          </div>
          {!pathname?.startsWith("/admin") && <Footer />}
        </main>
      </div>
    </div>
  );
}
