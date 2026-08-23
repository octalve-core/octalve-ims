/**
 * Sentry server runtime (Node.js API routes, Server Components, server actions).
 * Loaded from instrumentation.ts when NEXT_RUNTIME === "nodejs".
 */

import * as Sentry from "@sentry/nextjs";
import {
  getServerSentryInitOptions,
  isSentryEnabled,
} from "@/lib/monitoring/sentry-config";

if (isSentryEnabled()) {
  Sentry.init({
    ...getServerSentryInitOptions(),
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
  });
}
