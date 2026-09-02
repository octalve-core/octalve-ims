/**
 * Environment Variables Validation
 * Validates all required environment variables at startup.
 * Optional vars enable features (Stripe, Brevo, Redis, etc.); app runs with only required vars.
 */

/** Must be set for the app to start; used by getEnvVar() and validateEnv(). */
const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXT_PUBLIC_API_URL",
] as const;

/** Optional: when set, enable ImageKit, OAuth, email, cache, payments, shipping, etc. */
const optionalEnvVars = [
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT",
  "NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY",
  "NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "BREVO_SENDER_NAME",
  "BREVO_ADMIN_EMAIL",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "UPSTASH_REDIS_URL",
  "UPSTASH_REDIS_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "REDIS_URL",
  "QSTASH_URL",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "OPENROUTER_API_KEY",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "SHIPPO_API_KEY",
  "SHIPPO_FROM_NAME",
  "SHIPPO_FROM_STREET1",
  "SHIPPO_FROM_STREET2",
  "SHIPPO_FROM_CITY",
  "SHIPPO_FROM_STATE",
  "SHIPPO_FROM_ZIP",
  "SHIPPO_FROM_COUNTRY",
  "SHIPPO_FROM_PHONE",
  "SHIPPO_FROM_EMAIL",
] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];
type OptionalEnvVar = (typeof optionalEnvVars)[number];
type EnvVar = RequiredEnvVar | OptionalEnvVar;

/**
 * Get environment variable with validation
 */
export function getEnvVar(key: RequiredEnvVar): string;
export function getEnvVar(key: OptionalEnvVar): string | undefined;
export function getEnvVar(key: EnvVar): string | undefined {
  const value = process.env[key];

  if (!value && requiredEnvVars.includes(key as RequiredEnvVar)) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * Validate all required environment variables
 * Call this at app startup to fail fast if config is missing
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing
        .map((v) => `  - ${v}`)
        .join("\n")}`,
    );
  }

  console.log("✅ Environment variables validated");
}

/**
 * Resolve the public base URL of the application.
 *
 * Resolution order (first truthy value wins):
 *  1. `NEXT_PUBLIC_API_URL` environment variable
 *  2. Origin derived from the incoming `Request` or Next.js `headers()` (server-side)
 *  3. `window.location.origin` (client-side / browser)
 *  4. `http://localhost:3000` (last resort)
 *
 * @param req - Optional: the current `Request` object when called inside a
 *              Route Handler. Passing it gives the most accurate origin on the
 *              server without relying on the `next/headers` import.
 */
export function getApiUrl(req?: Request): string {
  // 1. Explicit env var — highest priority
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  // 2a. Infer from the incoming request (Route Handlers)
  if (req) {
    try {
      const { protocol, host } = new URL(req.url);
      return `${protocol}//${host}`;
    } catch {
      // malformed URL — fall through
    }
  }

  // 2b. Infer from Next.js server headers (Server Components / Actions)
  if (typeof window === "undefined") {
    try {
      // Dynamic import keeps this tree-shakeable on the client bundle
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { headers } = require("next/headers") as {
        headers: () => { get: (key: string) => string | null };
      };
      const host = headers().get("host");
      const proto = headers().get("x-forwarded-proto") ?? "http";
      if (host) return `${proto}://${host}`;
    } catch {
      // next/headers unavailable outside the Next.js request context
    }
  }

  // 3. Browser origin (client components after hydration)
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  // 4. Last resort
  return "http://localhost:3000";
}

/**
 * Get all environment variables with their status
 * Useful for debugging configuration issues
 */
export function getEnvStatus() {
  return {
    required: requiredEnvVars.map((key) => ({
      key,
      configured: !!process.env[key],
    })),
    optional: optionalEnvVars.map((key) => ({
      key,
      configured: !!process.env[key],
    })),
  };
}
