/**
 * Sentry edge runtime (middleware, edge routes).
 * Loaded from instrumentation.ts when NEXT_RUNTIME === "edge".
 */

import * as Sentry from "@sentry/nextjs";
import {
  getServerSentryInitOptions,
  isSentryEnabled,
} from "@/lib/monitoring/sentry-config";

if (isSentryEnabled()) {
  Sentry.init(getServerSentryInitOptions());
}
