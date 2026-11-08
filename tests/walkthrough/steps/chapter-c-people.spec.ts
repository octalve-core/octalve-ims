import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { wrapPage } from "../lib/guarded-page";
import { WalkthroughObservers } from "../observers";
import { installOverlay, setCaption } from "../lib/overlay";
import { Timeline, type TimelineStep } from "../lib/timeline";
import { FIRST_ADMIN, activateSelfRegisteredWalkthroughUser } from "../lib/seed-admin";

/**
 * Storyboard Chapter C (storyboard.md) — S-040 through S-047: User
 * Management, creating Kemi/Chidi/Bisi/Tunde/Ngozi with their roles, then
 * filtering, viewing a detail page, and (ISS-0094, fixed) deleting Ngozi
 * end-to-end to demonstrate the now-working admin delete path.
 *
 * Runs standalone, so it replays the tail of Chapter A/B's bootstrap
 * (register Folake, activate out-of-band and sign in, sign out, sign in as
 * Amara) unrecorded before the chapter's own timeline starts — see Chapter
 * B's file header for why.
 */

// Nested under WALKTHROUGH_OUT_DIR (not equal to it) so a multi-chapter run
// sharing one base dir doesn't have every chapter overwrite the others'
// timeline.json/chapters.vtt/screenshots — each chapter needs its own folder.
const OUT_DIR = path.join(
  process.env.WALKTHROUGH_OUT_DIR ?? path.join(process.cwd(), "out", "walkthrough-dev"),
  "chapter-c",
);

const BASE_URL = "http://localhost:3100";
const THROWAWAY_PASSWORD = "Walkthrough#2026";

test("Chapter C — people (user management)", async ({ page }) => {
  test.setTimeout(240_000);

  const observers = new WalkthroughObservers();
  observers.attach(page);
  await installOverlay(page);
  const timeline = new Timeline();
  const guarded = wrapPage(page);

  const password = () => guarded.locator("#password");
  const confirmPassword = () => guarded.locator("#confirmPassword");

  const screenshotsDir = path.join(OUT_DIR, "screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const step = (meta: Omit<TimelineStep, "startMs" | "endMs" | "screenshot">, fn: () => Promise<void>) => {
    const file = path.join(screenshotsDir, `${meta.id}.png`);
    return timeline.time(meta, path.relative(OUT_DIR, file), async () => {
      await fn();
      await page.screenshot({ path: file });
    });
  };

  // ---- Bootstrap (unrecorded) ----
  await guarded.gotoOnce("/");
  await expect(page).toHaveURL(/\/login$/);

  await guarded.click(guarded.getByRole("link", { name: "Create account" }));
  await expect(page).toHaveURL(/\/register$/);
  await guarded.typeHumanlike(guarded.getByLabel("Name"), "Folake Adewale");
  await guarded.typeHumanlike(guarded.getByLabel("Email"), "folake.adewale@walkthrough.test");
  await guarded.typeHumanlike(password(), THROWAWAY_PASSWORD);
  await guarded.typeHumanlike(confirmPassword(), THROWAWAY_PASSWORD);
  await guarded.click(guarded.getByRole("button", { name: "Sign Up" }));
  await page.waitForURL(/\/login$/, { timeout: 10_000 });

  // Task 0004 decision (a) (built after this bootstrap was first written):
  // self-registration now creates PENDING_VERIFICATION and issues NO session
  // at all, so there's nothing to "discover" via a reload anymore. Activate
  // out-of-band (see activateSelfRegisteredWalkthroughUser's doc comment),
  // then log in explicitly — same fix as Chapter D's bootstrap.
  await activateSelfRegisteredWalkthroughUser(process.env.DATABASE_URL!, "folake.adewale@walkthrough.test");

  await guarded.typeHumanlike(guarded.getByLabel("Email"), "folake.adewale@walkthrough.test");
  await guarded.typeHumanlike(password(), THROWAWAY_PASSWORD);
  await guarded.click(guarded.getByRole("button", { name: "Sign In" }));
  await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");
  await expect(guarded.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
  await expect(guarded.getByText("Folake Adewale").first()).toBeVisible();
  await expect(guarded.getByRole("button", { name: "Log out" })).toBeVisible();

  // Same reload-hydration race as Chapter B's bootstrap (empirically
  // confirmed intermittent, not a logic bug) — poll briefly and retry once.
  const logoutDialog = guarded.getByRole("alertdialog", { name: "Log out?" });
  await guarded.click(guarded.getByRole("button", { name: "Log out" }));
  let dialogOpened = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (await logoutDialog.count()) {
      dialogOpened = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  if (!dialogOpened) {
    await guarded.click(guarded.getByRole("button", { name: "Log out" }));
  }
  await expect(logoutDialog).toBeVisible();
  await guarded.click(guarded.getByRole("button", { name: "Log Out" }));
  await page.waitForURL((url) => url.pathname === "/login", { timeout: 15_000 });

  await guarded.typeHumanlike(guarded.getByLabel("Email"), FIRST_ADMIN.email);
  await guarded.typeHumanlike(password(), FIRST_ADMIN.password);
  await guarded.click(guarded.getByRole("button", { name: "Sign In" }));
  await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
  await expect(guarded.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();

  await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "User Management" }));
  await expect(page).toHaveURL(/\/admin\/user-management$/);
  await observers.scanAccessibility(page, "/admin/user-management");

  // ---- Chapter C proper ----

  const createUserDialog = () => guarded.getByRole("dialog");

  /** Opens Create User, fills whichever fields are given, submits. */
  const createUser = async (fields: { name?: string; email?: string; role?: string; username?: string }) => {
    await guarded.click(guarded.getByRole("button", { name: "Create User" }));
    await expect(createUserDialog().getByRole("heading", { name: "Create New User" })).toBeVisible();
    if (fields.name) {
      await guarded.typeHumanlike(createUserDialog().getByLabel("Full Name *"), fields.name);
    }
    if (fields.email) {
      await guarded.typeHumanlike(createUserDialog().getByLabel("Email Address *"), fields.email);
    }
    if (fields.email) {
      await guarded.typeHumanlike(createUserDialog().getByLabel("Password *"), THROWAWAY_PASSWORD);
    }
    if (fields.username) {
      await guarded.typeHumanlike(createUserDialog().getByLabel("Username"), fields.username);
    }
    if (fields.role) {
      await guarded.click(createUserDialog().getByRole("combobox"));
      await guarded.click(guarded.getByRole("option", { name: fields.role }));
    }
    await guarded.click(createUserDialog().getByRole("button", { name: "Create User" }));
  };

  await step({ id: "S-040", chapter: "C", role: "admin", name: "Create User validation on empty submit", covers: ["S-040"] }, async () => {
    await setCaption(page, "Opening Create User and submitting it empty...");
    await createUser({});
    await expect(createUserDialog().getByText("Name is required")).toBeVisible();
    await expect(createUserDialog().getByText("Valid email is required")).toBeVisible();
    // Task 0004 decision (b), built 2026-10-26: minimum raised from 6 to 8.
    await expect(createUserDialog().getByText("Password must be at least 8 characters")).toBeVisible();
    await guarded.click(createUserDialog().getByRole("button", { name: "Cancel" }));
    await expect(createUserDialog()).toHaveCount(0);
  });

  await step({ id: "S-041", chapter: "C", role: "admin", name: "Create Kemi Adeyemi (Supplier), leaving Username blank", covers: ["S-041"] }, async () => {
    await setCaption(page, "Creating Kemi Adeyemi as a Supplier, leaving Username blank...");
    await createUser({ name: "Kemi Adeyemi", email: "kemi.adeyemi@walkthrough.test", role: "Supplier" });

    // ISS-0095, fixed this session: the schema now preprocesses the form's
    // own "" default to undefined before `.optional()` sees it, so leaving
    // Username blank (it carries no "*" and no required styling, correctly
    // signaling it really is optional) now succeeds instead of silently
    // blocking on Zod's raw min-length message.
    await expect(guarded.getByText("User created").first()).toBeVisible();
    const row = guarded.locator("table tbody tr").filter({ hasText: "Kemi Adeyemi" });
    await expect(row.getByText("Supplier", { exact: true })).toBeVisible();
  });

  await step({ id: "S-042", chapter: "C", role: "admin", name: "Create Chidi Eze and Bisi Lawal (Client)", covers: ["S-042"] }, async () => {
    // Both given a username anyway, just to vary the test data — ISS-0095
    // (fixed) means it's no longer required to avoid a validation error.
    await setCaption(page, "Creating Chidi Eze as a Client...");
    await createUser({ name: "Chidi Eze", email: "chidi.eze@walkthrough.test", role: "Client", username: "chidi.eze" });
    await expect(guarded.getByText("User created").first()).toBeVisible();
    await setCaption(page, "Creating Bisi Lawal as a Client...");
    await createUser({ name: "Bisi Lawal", email: "bisi.lawal@walkthrough.test", role: "Client", username: "bisi.lawal" });
    await expect(guarded.getByText("User created").first()).toBeVisible();
    for (const name of ["Chidi Eze", "Bisi Lawal"]) {
      const row = guarded.locator("table tbody tr").filter({ hasText: name });
      await expect(row.getByText("Client", { exact: true })).toBeVisible();
    }
  });

  await step({ id: "S-043", chapter: "C", role: "admin", name: "Create Tunde Bello (Retailer)", covers: ["S-043"] }, async () => {
    await setCaption(page, "Creating Tunde Bello as a Retailer...");
    await createUser({ name: "Tunde Bello", email: "tunde.bello@walkthrough.test", role: "Retailer", username: "tunde.bello" });
    await expect(guarded.getByText("User created").first()).toBeVisible();
    const row = guarded.locator("table tbody tr").filter({ hasText: "Tunde Bello" });
    await expect(row.getByText("Retailer", { exact: true })).toBeVisible();
  });

  await step({ id: "S-044", chapter: "C", role: "admin", name: "Create Ngozi Obi (User)", covers: ["S-044"] }, async () => {
    await setCaption(page, "Creating Ngozi Obi with the default User role...");
    await createUser({ name: "Ngozi Obi", email: "ngozi.obi@walkthrough.test", username: "ngozi.obi" });
    await expect(guarded.getByText("User created").first()).toBeVisible();
    const row = guarded.locator("table tbody tr").filter({ hasText: "Ngozi Obi" });
    await expect(row.getByText("User", { exact: true })).toBeVisible();
  });

  await step({ id: "S-045", chapter: "C", role: "admin", name: "Filter by role, then search", covers: ["S-045"] }, async () => {
    // { exact: true } — selecting a role renders a "Clear role filter" chip
    // whose accessible name also substring-matches "Role" under Playwright's
    // default case-insensitive matching, colliding with the dropdown trigger.
    const roleFilterButton = guarded.getByRole("button", { name: "Role", exact: true });

    await setCaption(page, "Filtering by role Client...");
    await guarded.click(roleFilterButton);
    await guarded.click(guarded.getByRole("option", { name: "Client" }));
    await guarded.click(roleFilterButton); // close the popover
    await expect(guarded.getByText("Chidi Eze")).toBeVisible();
    await expect(guarded.getByText("Bisi Lawal")).toBeVisible();
    await expect(guarded.getByText("Kemi Adeyemi")).toHaveCount(0);

    await setCaption(page, "Clearing the role filter...");
    await guarded.click(roleFilterButton);
    await guarded.click(guarded.getByRole("button", { name: "Clear Filters" }));
    await guarded.click(roleFilterButton); // close the popover
    await expect(guarded.getByText("Kemi Adeyemi")).toBeVisible();

    await setCaption(page, "Searching for Kemi...");
    await guarded.typeHumanlike(guarded.getByPlaceholder("Search by name, email, or username..."), "Kemi");
    await expect(guarded.getByText("Kemi Adeyemi")).toBeVisible();
    await expect(guarded.getByText("Chidi Eze")).toHaveCount(0);
    await guarded.clearHumanlike(guarded.getByPlaceholder("Search by name, email, or username..."));
    await expect(guarded.getByText("Chidi Eze")).toBeVisible();
  });

  await step(
    {
      id: "S-046",
      chapter: "C",
      role: "admin",
      name: "Chidi's detail page — editable name, Delete now enabled for a non-self user",
      covers: ["S-046"],
    },
    async () => {
      await setCaption(page, "Opening Chidi's detail page...");
      await guarded.click(guarded.getByRole("link", { name: "Chidi Eze" }));
      await expect(page).toHaveURL(/\/admin\/user-management\/[^/]+$/);
      await expect(guarded.getByRole("heading", { name: "User Details" })).toBeVisible();
      await expect(guarded.getByText("Chidi Eze · chidi.eze@walkthrough.test")).toBeVisible();
      await observers.scanAccessibility(page, "/admin/user-management/[id]");

      // No Edit/Cancel toggle exists — the Name field is always directly
      // editable. Clicking in without typing changes nothing, so no Save
      // button ever appears.
      await setCaption(page, "Clicking into the Name field without changing it...");
      await guarded.click(guarded.locator("#um-name"));
      await expect(guarded.getByRole("button", { name: "Save" })).toHaveCount(0);

      // ISS-0094, fixed: Delete User is now enabled for anyone but yourself
      // (a self-delete is still refused server-side) — confirmed here without
      // actually deleting Chidi; S-047 demonstrates the full delete flow.
      await setCaption(page, "Checking whether Chidi can be deleted...");
      const deleteButton = guarded.getByRole("button", { name: "Delete User" });
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeEnabled();
    },
  );

  await step(
    {
      id: "S-047",
      chapter: "C",
      role: "admin",
      name: "Delete Ngozi end-to-end from the list (ISS-0094 fixed)",
      covers: ["S-047"],
    },
    async () => {
      await setCaption(page, "Going back to User Management...");
      await guarded.goBack();
      await expect(page).toHaveURL(/\/admin\/user-management$/);
      // Scoped to the table: a lingering "Ngozi Obi (...) has been created"
      // toast from S-044 can still contain this text too.
      const ngoziRow = guarded.locator("table tbody tr").filter({ hasText: "Ngozi Obi" });
      await expect(ngoziRow).toBeVisible();

      // ISS-0094, fixed: the row's "Delete User" action now works — like
      // "View Detail"/"Edit User", it's a shortcut to the detail page, where
      // the real delete button and its confirmation dialog live.
      await setCaption(page, "Opening Ngozi's row actions...");
      await guarded.click(ngoziRow.getByRole("button", { name: "Actions" }));
      await guarded.click(guarded.getByRole("menuitem", { name: "Delete User" }));
      await expect(page).toHaveURL(/\/admin\/user-management\/[^/]+$/);
      await expect(guarded.getByText("Ngozi Obi · ngozi.obi@walkthrough.test")).toBeVisible();

      await setCaption(page, "Deleting Ngozi...");
      await guarded.click(guarded.getByRole("button", { name: "Delete User" }));
      await expect(guarded.getByRole("alertdialog", { name: "Delete user?" })).toBeVisible();
      await guarded.click(guarded.getByRole("button", { name: "Delete" }));
      await page.waitForURL(/\/admin\/user-management$/, { timeout: 10_000 });
      await expect(guarded.getByText("Ngozi Obi")).toHaveCount(0);
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
