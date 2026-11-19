import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { SENTRY_TUNNEL_PATH } from "./lib/monitoring/sentry-config";
import { buildNextProductionHeaderRules } from "./lib/vercel/production-headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "robohash.org",
      },
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  compiler: {
    // Strip plain console noise in production, but keep warn/error visible —
    // without this, any console.warn/error that bypasses lib/logger.ts (e.g.
    // in scripts or third-party code paths) is silently discarded server-side
    // with no log sink to catch it (ISS-0053).
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  poweredByHeader: false,

  experimental: {
    optimizePackageImports: ["@/components", "@/lib"],
  },

  // Security + /_next/static immutable cache — see lib/vercel/production-headers.ts
  async headers() {
    return buildNextProductionHeaderRules();
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "your-sentry-org",
  project: process.env.SENTRY_PROJECT ?? "octalve-ims",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // First-party tunnel — must match `tunnel` in instrumentation-client.ts (SENTRY_TUNNEL_PATH)
  tunnelRoute: SENTRY_TUNNEL_PATH,
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
