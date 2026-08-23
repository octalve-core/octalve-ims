/**
 * Legacy Sentry client config filename (webpack plugin compatibility).
 * Client init lives in instrumentation-client.ts — do not call Sentry.init here
 * or events will be double-reported.
 */

export { SENTRY_TUNNEL_PATH } from "@/lib/monitoring/sentry-config";
