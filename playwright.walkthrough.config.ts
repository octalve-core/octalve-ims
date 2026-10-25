import { defineConfig } from "@playwright/test";

/**
 * Separate from the app's normal tooling on purpose (template rule 7.1):
 * outside the normal vitest suites, outside `npm run check`, never picked
 * up by `pnpm test` (vitest only matches dot-test-dot-ts files; every file
 * here is dot-spec-dot-ts instead).
 */
export default defineConfig({
  testDir: "tests/walkthrough",
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.WALKTHROUGH_BASE_URL || "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
    video: "on",
    screenshot: "off", // the journey takes its own, captioned screenshots
    trace: "off",
  },
});
