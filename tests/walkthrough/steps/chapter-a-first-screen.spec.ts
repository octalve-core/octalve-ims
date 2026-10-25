import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { wrapPage } from "../lib/guarded-page";
import { WalkthroughObservers } from "../observers";
import { installOverlay, setCaption } from "../lib/overlay";
import { Timeline, type TimelineStep } from "../lib/timeline";
import { FIRST_ADMIN } from "../lib/seed-admin";

/**
 * Storyboard Chapter A (storyboard.md) — S-001 through S-009. Amara's
 * admin account must already be provisioned out-of-band (seed-admin.ts)
 * before this runs; this chapter never creates it through the UI.
 */

const OUT_DIR =
  process.env.WALKTHROUGH_OUT_DIR ??
  path.join(process.cwd(), "out", "walkthrough-dev", "chapter-a");

/**
 * ISS-0030's hard-redirect leaves and returns to /login (window.location.href
 * = "/", which middleware then bounces back to /login since unauthenticated).
 * Two footguns ruled out empirically, not guessed:
 * `page.waitForURL(/\/login$/)` alone resolves instantly, since the CURRENT
 * url is already /login — it never waits for the round trip, which then
 * races a page.screenshot() against the real navigation and hangs
 * Chromium's screenshot command for minutes (confirmed via a network trace).
 * A two-stage `waitForURL` through pathname "/" doesn't work either: the
 * server-side bounce from "/" to "/login" resolves as ONE navigation before
 * any frame ever commits at "/", so that intermediate state is never
 * observable (confirmed: Playwright reported "navigated to .../login" twice
 * with no "/" in between). Waiting for the next real `framenavigated` event
 * is reload-sensitive regardless of which URL it ends up reporting.
 */
async function waitForIss0030RoundTrip(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForEvent("framenavigated", { timeout: timeoutMs });
  await page.waitForLoadState("load", { timeout: timeoutMs });
}

test("Chapter A — first screen and authentication (anonymous)", async ({ page }) => {
  test.setTimeout(240_000);

  const observers = new WalkthroughObservers();
  observers.attach(page);
  await installOverlay(page);
  const timeline = new Timeline();
  const guarded = wrapPage(page);

  // AuthFieldInput's <label> wraps both the password <input> and its
  // show/hide toggle <button> (an a11y quirk: both read as "labeled" by
  // getByLabel, a strict-mode violation) — #password/#confirmPassword are
  // the two explicit ids AuthPasswordInput always sets, so they're used
  // directly instead.
  const password = () => guarded.locator("#password");
  const confirmPassword = () => guarded.locator("#confirmPassword");

  const screenshotsDir = path.join(OUT_DIR, "screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  /** Runs a step's actions, then screenshots the *resulting* state (not the prior one). */
  const step = (meta: Omit<TimelineStep, "startMs" | "endMs" | "screenshot">, fn: () => Promise<void>) => {
    const file = path.join(screenshotsDir, `${meta.id}.png`);
    return timeline.time(meta, path.relative(OUT_DIR, file), async () => {
      await fn();
      await page.screenshot({ path: file });
    });
  };

  await step(
    { id: "S-001", chapter: "A", role: "anonymous", name: "First page load", covers: ["S-001"] },
    async () => {
      await setCaption(page, "Opening the app for the first time...");
      await guarded.gotoOnce("/");
      await expect(page).toHaveURL(/\/login$/);
      await expect(guarded.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await expect(guarded.getByLabel("Email")).toBeVisible();
      await expect(password()).toBeVisible();
      await expect(guarded.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await expect(guarded.getByRole("link", { name: "Create account" })).toBeVisible();
    },
  );

  await step(
    { id: "S-002", chapter: "A", role: "anonymous", name: "Submit sign-in with empty fields", covers: ["S-002"] },
    async () => {
      await setCaption(page, "Clicking Sign in with nothing filled out...");
      await guarded.click(guarded.getByRole("button", { name: "Sign In" }));
      await expect(page).toHaveURL(/\/login$/);
      const emailValid = await guarded
        .getByLabel("Email")
        .evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(emailValid).toBe(false);
    },
  );

  await step(
    { id: "S-003", chapter: "A", role: "anonymous", name: "Sign in with unknown credentials", covers: ["S-003"] },
    async () => {
      await setCaption(page, "Trying an email that doesn't exist...");
      await guarded.typeHumanlike(guarded.getByLabel("Email"), "nobody@walkthrough.test");
      await guarded.typeHumanlike(password(), "WrongPassword123");
      await guarded.click(guarded.getByRole("button", { name: "Sign In" }));
      // ISS-0030: the failed refresh fires window.location.href = "/" before
      // the login() rejection ever reaches LoginPage's own catch/toast.
      await waitForIss0030RoundTrip(page);
      await expect(guarded.getByLabel("Email")).toHaveValue("");
    },
  );

  await step(
    { id: "S-004", chapter: "A", role: "anonymous", name: "Sign in with the demo Admin account", covers: ["S-004"] },
    async () => {
      await setCaption(page, "Picking the demo Admin account...");
      await guarded.click(guarded.locator("[data-login-role-select]"));
      await guarded.click(guarded.getByRole("option", { name: /test@admin\.com/ }));
      await expect(guarded.getByLabel("Email")).toHaveValue("test@admin.com");
      await guarded.click(guarded.getByRole("button", { name: "Sign In" }));
      await waitForIss0030RoundTrip(page); // same ISS-0030 path: account doesn't exist in a fresh DB
    },
  );

  await step(
    { id: "S-005", chapter: "A", role: "anonymous", name: "Forgot password flow", covers: ["S-005"] },
    async () => {
      await setCaption(page, "Following Forgot password...");
      await guarded.click(guarded.getByRole("link", { name: "Forgot password?" }));
      await expect(page).toHaveURL(/\/forgot-password$/);
      await guarded.click(guarded.getByRole("button", { name: "Send Reset Link" }));
      const emailValid = await guarded
        .getByLabel("Email")
        .evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(emailValid).toBe(false);

      await guarded.typeHumanlike(guarded.getByLabel("Email"), "nobody@walkthrough.test");
      await guarded.click(guarded.getByRole("button", { name: "Send Reset Link" }));
      await expect(guarded.getByText("Check your email")).toBeVisible();
      await expect(guarded.getByText(/If an account exists for/)).toBeVisible();
    },
  );

  await step(
    { id: "S-006", chapter: "A", role: "anonymous", name: "Open Create account", covers: ["S-006"] },
    async () => {
      await setCaption(page, "Back to sign in, then Create account...");
      await guarded.click(guarded.getByRole("link", { name: "Back to sign in" }));
      await expect(page).toHaveURL(/\/login$/);
      await guarded.click(guarded.getByRole("link", { name: "Create account" }));
      await expect(page).toHaveURL(/\/register$/);
      await expect(guarded.getByRole("heading", { name: "Create account" })).toBeVisible();
    },
  );

  await step(
    { id: "S-007", chapter: "A", role: "anonymous", name: "Register validation cases", covers: ["S-007"] },
    async () => {
      await setCaption(page, "Submitting the register form empty, then with bad values...");
      await guarded.click(guarded.getByRole("button", { name: "Sign Up" }));
      const nameValid = await guarded
        .getByLabel("Name")
        .evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(nameValid).toBe(false);

      await guarded.typeHumanlike(guarded.getByLabel("Name"), "Temp Invalid Case");
      await guarded.typeHumanlike(guarded.getByLabel("Email"), "not-an-email");
      await guarded.click(guarded.getByRole("button", { name: "Sign Up" }));
      const emailValid = await guarded
        .getByLabel("Email")
        .evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(emailValid).toBe(false);

      // Password has no `required`/minLength attribute (RegisterPage.tsx) —
      // native validation won't catch a short password; the server's
      // registerSchema (min 6) does, but the client only ever surfaces the
      // route's generic top-level `error` field ("Invalid request body"),
      // never the per-field Zod message from `details` — so the visible
      // message is generic, not "Password must be at least 6 characters".
      await guarded.clearHumanlike(guarded.getByLabel("Email"));
      await guarded.typeHumanlike(guarded.getByLabel("Email"), "temp-invalid-case@walkthrough.test");
      await guarded.typeHumanlike(password(), "ab1de");
      await guarded.typeHumanlike(confirmPassword(), "ab1de");
      await guarded.click(guarded.getByRole("button", { name: "Sign Up" }));
      await expect(guarded.getByText("Registration Failed")).toBeVisible();
      await expect(guarded.getByText("Invalid request body")).toBeVisible();
    },
  );

  await step(
    { id: "S-008", chapter: "A", role: "anonymous", name: "Self-register Folake (throwaway user)", covers: ["S-008"] },
    async () => {
      await setCaption(page, "Registering Folake Adewale...");
      await guarded.clearHumanlike(guarded.getByLabel("Name"));
      await guarded.clearHumanlike(guarded.getByLabel("Email"));
      await guarded.clearHumanlike(password());
      await guarded.clearHumanlike(confirmPassword());
      await guarded.typeHumanlike(guarded.getByLabel("Name"), "Folake Adewale");
      await guarded.typeHumanlike(guarded.getByLabel("Email"), "folake.adewale@walkthrough.test");
      await guarded.typeHumanlike(password(), "Walkthrough#2026");
      await guarded.typeHumanlike(confirmPassword(), "Walkthrough#2026");
      await guarded.click(guarded.getByRole("button", { name: "Sign Up" }));
      // Toasts render both a visible div and a duplicate aria-live="assertive"
      // announcer with the same text — .first() picks the visible one.
      await expect(guarded.getByText("Account Created Successfully").first()).toBeVisible();
      // RegisterPage.tsx redirects to /login 1500ms after a 201 — no auto
      // sign-in. Current URL is /register here, so this is a real wait.
      await page.waitForURL(/\/login$/, { timeout: 10_000 });
    },
  );

  await step(
    {
      id: "S-008b",
      chapter: "A",
      role: "user",
      name: "Reload recovers ISS-0087's blank page — landing already signed in",
      covers: ["S-008b"],
    },
    async () => {
      // ISS-0087, root-caused: register sets a real session; the blank page
      // was /login's own now-authenticated-redirect failing to complete over
      // a client transition. A real person would see a blank page and hit
      // reload; reload() is a real browser action (not a second goto), and
      // the hard GET it triggers is what actually completes the redirect —
      // to "/", not back to "/login", because Folake really is signed in.
      await expect(guarded.getByLabel("Email")).toHaveCount(0);
      await setCaption(page, "The page came back blank — reloading...");
      await guarded.reload();
      await expect(page).toHaveURL("http://localhost:3100/");
      await expect(guarded.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
      await expect(guarded.getByText("Folake Adewale")).toBeVisible();
      // ISS-0088, confirmed not a data leak: the admin-shaped nav is shown,
      // but it correctly dead-ends. No toast ever told her she's signed in.
      const usersApiCall = page.waitForResponse((res) => res.url().includes("/api/users"), { timeout: 5_000 }).catch(() => null);
      await guarded.click(guarded.getByRole("link", { name: "User Management" }));
      await page.waitForLoadState("load");
      const usersApiResponse = await usersApiCall;
      expect(usersApiResponse, "a user-role account must never reach the Users API").toBeNull();
      await expect(page).not.toHaveURL(/\/admin\/user-management$/);
    },
  );

  await step(
    {
      id: "S-008c",
      chapter: "A",
      role: "user",
      name: "Sign out as Folake before continuing as Amara",
      covers: ["S-008c"],
    },
    async () => {
      await setCaption(page, "Signing out...");
      await guarded.click(guarded.getByRole("button", { name: "Log out" }));
      await expect(guarded.getByRole("alertdialog", { name: "Log out?" })).toBeVisible();
      await guarded.click(guarded.getByRole("button", { name: "Log Out" }));
      await page.waitForURL((url) => url.pathname === "/login", { timeout: 15_000 });
      await expect(guarded.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await expect(guarded.getByLabel("Email")).toBeVisible();
    },
  );

  await step(
    { id: "S-009", chapter: "A", role: "admin", name: "Sign in as Amara (provisioned admin)", covers: ["S-009"] },
    async () => {
      await setCaption(page, "Signing in as Amara, the store owner...");
      await guarded.typeHumanlike(guarded.getByLabel("Email"), FIRST_ADMIN.email);
      await guarded.typeHumanlike(password(), FIRST_ADMIN.password);
      await guarded.click(guarded.getByRole("button", { name: "Sign In" }));
      // Current URL is /login here, so waiting for "/" is a real wait too.
      await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
      await expect(guarded.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
      await expect(guarded.getByText(/Welcome back, Amara Okafor/).first()).toBeVisible();
    },
  );

  timeline.writeJson(path.join(OUT_DIR, "timeline.json"));
  timeline.writeVtt(path.join(OUT_DIR, "chapters.vtt"));
  timeline.writeChaptersJson(path.join(OUT_DIR, "chapters.json"));

  const blocking = observers.blockingAxeViolations();
  fs.writeFileSync(
    path.join(OUT_DIR, "observer-events.json"),
    JSON.stringify({ errorEvents: observers.errorEvents(), axeViolations: observers.axeViolations }, null, 2),
  );
  expect(blocking, `Blocking axe violations: ${JSON.stringify(blocking, null, 2)}`).toHaveLength(0);
});
