/**
 * ISS-0004 — without the `Boolean(internalApiKey)` guard, an unset
 * INTERNAL_API_KEY makes the expected header the literal string "Bearer
 * undefined" (template-literal interpolation of `undefined`), so any
 * caller sending that exact header would pass as an authenticated
 * internal/cron call on a deployment where the env var was never set.
 */
export function isAuthorizedInternalCall(
  authHeader: string | null,
  internalApiKey: string | undefined,
): boolean {
  return Boolean(internalApiKey) && authHeader === `Bearer ${internalApiKey}`;
}
