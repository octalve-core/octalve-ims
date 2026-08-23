import type { NextRequest } from "next/server";

/**
 * Header-based CSRF defense (ported verbatim from Proplity, see
 * out/auth-system-port-plan.md). Trusts the browser-controlled Origin
 * header (falls back to Referer) — a page's own JS cannot forge either for
 * a cross-origin request, so comparing against Host/X-Forwarded-Host is
 * enough without a separate CSRF token. Requests with neither header
 * present are rejected outright.
 *
 * Applied per-route (call at the top of every mutating auth route handler)
 * rather than globally, so a route can be deliberately exempted — e.g.
 * verify-email, which is legitimately reached via an emailed cross-origin
 * link.
 */
export function validateCSRF(req: NextRequest): boolean {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return false;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return false;
}
