"use client";

import { useEffect } from "react";
import { refreshAccessToken } from "@/lib/auth/refresh-client";

/**
 * Proactive silent refresh, ported from Proplity — see
 * docs/auth-system-port-plan.md, Phase 4. Fires 2 minutes before the 15-min
 * access token expires so a user mid-session never hits a hard 401.
 *
 * Multi-tab safety: refresh rotates the shared httpOnly cookie, so if this
 * tab's `/auth/refresh` call loses a race against another tab's concurrent
 * refresh, a bare failure would wrongly look like "logged out." Re-checking
 * `/auth/session` before redirecting avoids that false negative — only
 * redirects when both refresh AND the session check fail, meaning the
 * session is actually dead everywhere, not just stale in this tab.
 */
export function useAuthRefresh(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;

    const INTERVAL_MS = 13 * 60 * 1000; // 13 min — 2 min before the 15-min access token expires

    const performSilentRefresh = async () => {
      try {
        // The shared single-flight helper, not a bare fetch: if a request in this tab already hit
        // a 401 and is refreshing, this timer joins that call instead of racing it with the same
        // refresh token (ISS-0028).
        if (await refreshAccessToken()) return;

        const check = await fetch("/api/auth/session");
        if (!check.ok && typeof window !== "undefined") {
          window.location.href = "/";
        }
      } catch {
        // network hiccup — next interval retries
      }
    };

    const timer = setInterval(performSilentRefresh, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAuthenticated]);
}
