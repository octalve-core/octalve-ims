/**
 * Client-safe single-flight refresh dedup, ported from Proplity's
 * lib/apiClient.ts — see docs/auth-system-port-plan.md, Phase 4.
 *
 * Deliberately separate from jwt.ts/session.ts (which pull in `jose` and
 * `next/headers`, server-only) so this stays safe to import into client
 * bundles — used by both utils/axiosInstance.ts and lib/api/client.ts.
 *
 * The first caller to hit a 401 sets the shared promise; any other caller
 * that hits a 401 while it's still pending awaits the SAME promise instead
 * of issuing a second /refresh request — this is what collapses several
 * concurrent 401s into exactly one network call.
 */

let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
