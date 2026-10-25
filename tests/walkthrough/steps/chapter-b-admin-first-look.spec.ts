import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { wrapPage } from "../lib/guarded-page";
import { WalkthroughObservers } from "../observers";
import { installOverlay, setCaption } from "../lib/overlay";
import { Timeline, type TimelineStep } from "../lib/timeline";
import { FIRST_ADMIN } from "../lib/seed-admin";

/**
 * Storyboard Chapter B (storyboard.md) — S-010 through S-033: Amara's first
 * look around the admin shell on an otherwise-empty database (Folake's
 * self-registered account from S-008 must also exist, since S-023 expects
 * two users listed).
 *
 * This file runs standalone, so it replays the tail of Chapter A
 * (S-008/S-008b/S-008c/S-009 — register Folake, recover from ISS-0087's
 * blank page, sign out, sign in as Amara) as an unrecorded bootstrap before
 * the chapter's own timeline starts. It is not re-asserted or re-screenshot
 * here — Chapter A already covers it. In the eventual continuous Phase 3
 * run, this chapter will simply inherit that state from Chapter A's own
 * steps instead of replaying them.
 */

const OUT_DIR =
  process.env.WALKTHROUGH_OUT_DIR ??
  path.join(process.cwd(), "out", "walkthrough-dev", "chapter-b");

const BASE_URL = "http://localhost:3100";

test("Chapter B — admin's first look (empty database)", async ({ page }) => {
  test.setTimeout(300_000);

  const observers = new WalkthroughObservers();
  observers.attach(page);
  await installOverlay(page);
  const timeline = new Timeline();
  const guarded = wrapPage(page);

  const password = () => guarded.locator("#password");
  const confirmPassword = () => guarded.locator("#confirmPassword");
  // The sidebar is a single unnamed <nav> inside an <aside aria-label=
  // "Primary navigation"> (role complementary, not "navigation" — same
  // gotcha as Chapter A). Scoping every sidebar click to this landmark
  // avoids colliding with identically-labeled links/tiles elsewhere on a
  // given page (e.g. the dashboard's Quick Access grid).
  const sidebarNav = () => guarded.getByRole("navigation");

  const screenshotsDir = path.join(OUT_DIR, "screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const step = (meta: Omit<TimelineStep, "startMs" | "endMs" | "screenshot">, fn: () => Promise<void>) => {
    const file = path.join(screenshotsDir, `${meta.id}.png`);
    return timeline.time(meta, path.relative(OUT_DIR, file), async () => {
      await fn();
      await page.screenshot({ path: file });
    });
  };

  // ---- Bootstrap (unrecorded — mirrors Chapter A's S-008/S-008b/S-008c/S-009) ----
  await guarded.gotoOnce("/");
  await expect(page).toHaveURL(/\/login$/);

  await guarded.click(guarded.getByRole("link", { name: "Create account" }));
  await expect(page).toHaveURL(/\/register$/);
  await guarded.typeHumanlike(guarded.getByLabel("Name"), "Folake Adewale");
  await guarded.typeHumanlike(guarded.getByLabel("Email"), "folake.adewale@walkthrough.test");
  await guarded.typeHumanlike(password(), "Walkthrough#2026");
  await guarded.typeHumanlike(confirmPassword(), "Walkthrough#2026");
  await guarded.click(guarded.getByRole("button", { name: "Sign Up" }));
  await expect(guarded.getByText("Account Created Successfully").first()).toBeVisible();
  await page.waitForURL(/\/login$/, { timeout: 10_000 });

  // ISS-0087: register leaves a blank page at /login; a reload completes
  // the now-authenticated redirect (lands signed in as Folake, on "/").
  await guarded.reload();
  await expect(page).toHaveURL(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");
  await expect(guarded.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
  await expect(guarded.getByText("Folake Adewale").first()).toBeVisible();
  await expect(guarded.getByRole("button", { name: "Log out" })).toBeVisible();

  // Empirically confirmed intermittent (not a logic bug — identical code
  // passed and failed across repeated runs on this shared, variably-loaded
  // sandbox): a reload()'s "load" event can fire before React finishes
  // attaching handlers, so the very first click after a reload occasionally
  // lands before the button is truly interactive. A real person in that
  // situation clicks again when nothing visibly happens, so this polls
  // briefly and retries once rather than failing outright.
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

  // ---- Chapter B proper ----

  await step({ id: "S-010", chapter: "B", role: "admin", name: "Dashboard zero-state", covers: ["S-010"] }, async () => {
    await setCaption(page, "Looking at the dashboard...");
    await expect(guarded.getByRole("heading", { name: "Store Overview", level: 2 })).toBeVisible();
    for (const title of [
      "Total Products", "Total Value", "Total Revenue", "Total Orders",
      "Invoices", "Total Warehouses", "Total Suppliers", "Categories",
    ]) {
      await expect(guarded.getByText(title, { exact: true }).first()).toBeVisible();
    }
    const quickAccess = guarded.locator("div.pb-6").filter({ hasText: "Quick Access" });
    await expect(quickAccess.getByRole("heading", { name: "Quick Access" })).toBeVisible();
    for (const tile of [
      "Dashboard", "Products", "Orders", "Invoices", "Categories",
      "Suppliers", "Warehouses", "Business Insights", "Admin Panel",
    ]) {
      await expect(quickAccess.getByRole("link", { name: tile, exact: true })).toBeVisible();
    }
    await observers.scanAccessibility(page, "/ (dashboard)");
  });

  await step({ id: "S-011", chapter: "B", role: "admin", name: "Store Overview analytics", covers: ["S-011"] }, async () => {
    await setCaption(page, "Checking Store Overview...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Store Overview", exact: true }));
    await expect(page).toHaveURL(/\/admin\/dashboard-overall-insights$/);
    await expect(guarded.getByRole("heading", { name: /Store Analytics & Dashboard/ })).toBeVisible();
    await expect(guarded.getByText("No orders yet")).toBeVisible();
    await expect(guarded.getByText("No tickets yet")).toBeVisible();
    await expect(guarded.getByText("No reviews yet")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/dashboard-overall-insights");
  });

  await step({ id: "S-012", chapter: "B", role: "admin", name: "Business Insights empty tabs", covers: ["S-012"] }, async () => {
    await setCaption(page, "Checking Business Insights...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Business Insights", exact: true }));
    await expect(page).toHaveURL(/\/business-insights$/);
    await expect(guarded.getByRole("heading", { name: "Product Inventory Business Insights" })).toBeVisible();
    for (const tab of ["Overview", "Distribution", "Trends", "Warehouses", "Alerts"]) {
      await expect(guarded.getByRole("tab", { name: tab })).toBeVisible();
    }
    await observers.scanAccessibility(page, "/business-insights");
  });

  await step({ id: "S-013", chapter: "B", role: "admin", name: "Orders empty list", covers: ["S-013"] }, async () => {
    await setCaption(page, "Checking Orders...");
    // Not exact: admin-nav-config attaches a live count badge ("Orders 0"),
    // so the accessible name is never just the bare label.
    await guarded.click(sidebarNav().getByRole("link", { name: "Orders" }));
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(guarded.getByRole("heading", { name: "Store Orders Management (self + client)" })).toBeVisible();
    await expect(guarded.getByText("No orders found.")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/orders");
  });

  await step({ id: "S-014", chapter: "B", role: "admin", name: "Invoices empty list", covers: ["S-014"] }, async () => {
    await setCaption(page, "Checking Invoices...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Invoices" }));
    await expect(page).toHaveURL(/\/admin\/invoices$/);
    await expect(guarded.getByRole("heading", { name: "Store Invoices Management (self + client)" })).toBeVisible();
    await expect(guarded.getByText("No invoices found.")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/invoices");
  });

  await step({ id: "S-015", chapter: "B", role: "admin", name: "Support Tickets empty list", covers: ["S-015"] }, async () => {
    await setCaption(page, "Checking Support Tickets...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Support Tickets" }));
    await expect(page).toHaveURL(/\/admin\/support-tickets$/);
    await expect(guarded.getByRole("heading", { name: "Store Support Tickets (assigned to you)" })).toBeVisible();
    await expect(guarded.getByText("No support tickets found.")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/support-tickets");
  });

  await step({ id: "S-016", chapter: "B", role: "admin", name: "Product Reviews empty list", covers: ["S-016"] }, async () => {
    await setCaption(page, "Checking Product Reviews...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Product Reviews" }));
    await expect(page).toHaveURL(/\/admin\/product-reviews$/);
    await expect(guarded.getByRole("heading", { name: "Store Product Reviews (your products)" })).toBeVisible();
    await expect(guarded.getByText("No product reviews found.")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/product-reviews");
  });

  await step({ id: "S-017", chapter: "B", role: "admin", name: "Products empty list + controls", covers: ["S-017"] }, async () => {
    await setCaption(page, "Checking Products...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Products" }));
    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(guarded.getByRole("heading", { name: "Product Inventory Management" })).toBeVisible();
    await expect(guarded.getByText("No products added/found.")).toBeVisible();
    await expect(guarded.getByRole("button", { name: "Add Product" })).toBeVisible();
    await expect(guarded.getByRole("button", { name: "Import Products" })).toBeVisible();
    await expect(guarded.getByRole("button", { name: "Export Products" })).toBeVisible();
    await observers.scanAccessibility(page, "/admin/products");
  });

  await step({ id: "S-018", chapter: "B", role: "admin", name: "Categories empty list", covers: ["S-018"] }, async () => {
    await setCaption(page, "Checking Categories...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Categories", exact: true }));
    await expect(page).toHaveURL(/\/categories$/);
    await expect(guarded.getByRole("heading", { name: "Category Management" })).toBeVisible();
    await expect(guarded.getByText("No categories added/found.")).toBeVisible();
    await observers.scanAccessibility(page, "/categories");
  });

  await step({ id: "S-019", chapter: "B", role: "admin", name: "Suppliers empty list", covers: ["S-019"] }, async () => {
    await setCaption(page, "Checking Suppliers...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Suppliers", exact: true }));
    await expect(page).toHaveURL(/\/suppliers$/);
    await expect(guarded.getByRole("heading", { name: "Supplier Management" })).toBeVisible();
    await expect(guarded.getByText("No suppliers added/found.")).toBeVisible();
    await observers.scanAccessibility(page, "/suppliers");
  });

  await step({ id: "S-020", chapter: "B", role: "admin", name: "Warehouses empty list", covers: ["S-020"] }, async () => {
    await setCaption(page, "Checking Warehouses...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Warehouses" }));
    await expect(page).toHaveURL(/\/admin\/warehouses$/);
    await expect(guarded.getByRole("heading", { name: "Warehouse Management" })).toBeVisible();
    await expect(guarded.getByText("No warehouses found.")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/warehouses");
  });

  await step({ id: "S-021", chapter: "B", role: "admin", name: "Supplier Portal empty overview", covers: ["S-021"] }, async () => {
    await setCaption(page, "Checking Supplier Portal...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Supplier Portal" }));
    await expect(page).toHaveURL(/\/admin\/supplier-portal$/);
    await expect(guarded.getByRole("heading", { level: 1, name: /Supplier Portal/ })).toBeVisible();
    await expect(guarded.getByText("No suppliers yet. Add suppliers from the Suppliers page.")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/supplier-portal");
  });

  await step({ id: "S-022", chapter: "B", role: "admin", name: "Client Portal empty overview", covers: ["S-022"] }, async () => {
    await setCaption(page, "Checking Client Portal...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Client Portal" }));
    await expect(page).toHaveURL(/\/admin\/client-portal$/);
    await expect(guarded.getByRole("heading", { level: 1, name: /Client Portal/ })).toBeVisible();
    await expect(guarded.getByText("No client orders yet.")).toBeVisible();
    await expect(guarded.getByText("No client invoices yet.")).toBeVisible();
    await expect(
      guarded.getByText('No client users yet. Assign "client" role to users from User Management.'),
    ).toBeVisible();
    await observers.scanAccessibility(page, "/admin/client-portal");
  });

  await step({ id: "S-023", chapter: "B", role: "admin", name: "User Management — two users", covers: ["S-023"] }, async () => {
    await setCaption(page, "Checking User Management — should list Amara and Folake...");
    await guarded.click(sidebarNav().getByRole("link", { name: "User Management" }));
    await expect(page).toHaveURL(/\/admin\/user-management$/);
    await expect(guarded.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(guarded.getByText("Total Users")).toBeVisible();
    const usersTable = guarded.locator("table");
    await expect(usersTable.locator("tbody tr")).toHaveCount(2);
    // Scoped to the table: "Amara Okafor" also appears in the top-bar
    // account menu (the signed-in user's own name), a second match.
    await expect(usersTable.getByText("Amara Okafor")).toBeVisible();
    await expect(usersTable.getByText("Folake Adewale")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/user-management");
  });

  await step({ id: "S-024", chapter: "B", role: "admin", name: "Activity History", covers: ["S-024"] }, async () => {
    await setCaption(page, "Checking Activity History...");
    await guarded.click(sidebarNav().getByRole("link", { name: "Activity History", exact: true }));
    await expect(page).toHaveURL(/\/admin\/activity-history$/);
    // Correction to the storyboard's assumption: this is not a login feed —
    // it's "Import History" (nothing has been imported yet, so empty) plus
    // "Activity Logs" (whether admin/registration actions are logged here
    // is genuinely uncertain — checked live, not hard-asserted either way).
    await expect(guarded.getByRole("heading", { name: "Import History" })).toBeVisible();
    await expect(guarded.getByText("No import history found.")).toBeVisible();
    await expect(guarded.getByRole("heading", { name: "Activity Logs" })).toBeVisible();
    await observers.scanAccessibility(page, "/admin/activity-history");
  });

  await step({ id: "S-025", chapter: "B", role: "admin", name: "My Activity personal empty state", covers: ["S-025"] }, async () => {
    await setCaption(page, "Checking My Activity...");
    await guarded.click(sidebarNav().getByRole("link", { name: "My Activity", exact: true }));
    await expect(page).toHaveURL(/\/admin\/my-activity$/);
    await expect(guarded.getByRole("heading", { name: "My Activity (self-only as user)" })).toBeVisible();
    await expect(guarded.getByText("No orders found").first()).toBeVisible();
    await observers.scanAccessibility(page, "/admin/my-activity");
  });

  await step({ id: "S-026", chapter: "B", role: "admin", name: "Top-bar search filters and navigates", covers: ["S-026"] }, async () => {
    await setCaption(page, "Searching for 'ware'...");
    await guarded.typeHumanlike(guarded.getByPlaceholder("Search pages…"), "ware");
    const resultsPanel = guarded.locator("section").filter({ hasText: "Search results" });
    await expect(resultsPanel.getByRole("link", { name: "Warehouses", exact: true })).toBeVisible();
    await guarded.click(resultsPanel.getByRole("link", { name: "Warehouses", exact: true }));
    await expect(page).toHaveURL(/\/admin\/warehouses$/);
  });

  await step(
    { id: "S-027", chapter: "B", role: "admin", name: "Theme toggle and sidebar collapse", covers: ["S-027"] },
    async () => {
      await setCaption(page, "Switching to dark mode...");
      await guarded.click(guarded.getByRole("button", { name: "Toggle theme" }));
      await guarded.click(guarded.getByRole("menuitem", { name: "Dark" }));
      await expect(page.locator("html")).toHaveClass(/dark/);

      await setCaption(page, "Navigating away — does dark mode persist?");
      await guarded.click(sidebarNav().getByRole("link", { name: "Dashboard", exact: true }));
      await expect(page).toHaveURL(`${BASE_URL}/`);
      await expect(page.locator("html")).toHaveClass(/dark/);

      await setCaption(page, "Switching back to light mode...");
      await guarded.click(guarded.getByRole("button", { name: "Toggle theme" }));
      await guarded.click(guarded.getByRole("menuitem", { name: "Light" }));
      await expect(page.locator("html")).not.toHaveClass(/dark/);

      await setCaption(page, "Collapsing the sidebar...");
      await guarded.click(guarded.getByRole("button", { name: "Collapse sidebar" }));
      await expect(guarded.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
      await setCaption(page, "Expanding it again...");
      await guarded.click(guarded.getByRole("button", { name: "Expand sidebar" }));
      await expect(guarded.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
    },
  );

  await step({ id: "S-028", chapter: "B", role: "admin", name: "Notification bell empty dropdown", covers: ["S-028"] }, async () => {
    await setCaption(page, "Checking notifications...");
    await guarded.click(guarded.getByRole("button", { name: "Notifications" }));
    await expect(guarded.getByText("No notifications")).toBeVisible();
    // Close the dropdown the same way a person would, rather than leaving it
    // open for the next step's profile-menu click to fight over z-index.
    await guarded.click(guarded.getByRole("button", { name: "Notifications" }));
  });

  await step(
    { id: "S-029", chapter: "B", role: "admin", name: "Profile menu — Support Tickets", covers: ["S-029"] },
    async () => {
      await setCaption(page, "Opening the profile menu — Support Tickets...");
      await guarded.click(guarded.getByRole("button", { name: "Open account menu" }));
      // Confirms FND-01/ISS-pending: the profile menu has exactly these four
      // items — no change-password entry exists anywhere in it.
      await expect(guarded.getByRole("menuitem", { name: "Support Tickets" })).toBeVisible();
      await expect(guarded.getByRole("menuitem", { name: "Email Preferences" })).toBeVisible();
      await expect(guarded.getByRole("menuitem", { name: "API Documentation" })).toBeVisible();
      await expect(guarded.getByRole("menuitem", { name: "API Status" })).toBeVisible();
      await guarded.click(guarded.getByRole("menuitem", { name: "Support Tickets" }));
      await expect(page).toHaveURL(/\/support-tickets$/);
    },
  );

  await step(
    {
      id: "S-030",
      chapter: "B",
      role: "admin",
      name: "Profile menu — Email Preferences toggle persists",
      covers: ["S-030"],
    },
    async () => {
      await setCaption(page, "Opening Email Preferences...");
      await guarded.click(guarded.getByRole("button", { name: "Open account menu" }));
      await guarded.click(guarded.getByRole("menuitem", { name: "Email Preferences" }));
      await expect(page).toHaveURL(/\/settings\/email-preferences$/);
      // Not exact: the page also has an "About Email Preferences" h3, which
      // is a substring match of the bare label.
      await expect(guarded.getByRole("heading", { name: "Email Preferences", exact: true })).toBeVisible();

      const lowStockToggle = guarded.getByLabel("Low Stock Alerts");
      const before = await lowStockToggle.getAttribute("aria-checked");
      await setCaption(page, "Toggling Low Stock Alerts...");
      await guarded.click(lowStockToggle);
      // Toasts duplicate into a visible div + an aria-live announcer with
      // the same text (same gotcha as Chapter A) — .first() picks the real one.
      await expect(guarded.getByText("Email Preferences Updated").first()).toBeVisible();
      await guarded.click(guarded.getByRole("button", { name: "Save All Changes" }));

      await setCaption(page, "Navigating away and back to confirm it persisted...");
      await guarded.click(guarded.getByRole("button", { name: "Open account menu" }));
      await guarded.click(guarded.getByRole("menuitem", { name: "API Documentation" }));
      await expect(page).toHaveURL(/\/api-docs$/);
      await guarded.click(guarded.getByRole("button", { name: "Open account menu" }));
      await guarded.click(guarded.getByRole("menuitem", { name: "Email Preferences" }));
      await expect(page).toHaveURL(/\/settings\/email-preferences$/);
      await expect(guarded.getByLabel("Low Stock Alerts")).toHaveAttribute(
        "aria-checked",
        before === "true" ? "false" : "true",
      );
    },
  );

  await step(
    { id: "S-031", chapter: "B", role: "admin", name: "Profile menu — API Documentation", covers: ["S-031"] },
    async () => {
      await setCaption(page, "Opening API Documentation...");
      await guarded.click(guarded.getByRole("button", { name: "Open account menu" }));
      await guarded.click(guarded.getByRole("menuitem", { name: "API Documentation" }));
      await expect(page).toHaveURL(/\/api-docs$/);
      await expect(guarded.getByRole("heading", { name: "Stock API Documentation" })).toBeVisible();
    },
  );

  await step(
    { id: "S-032", chapter: "B", role: "admin", name: "Profile menu — API Status", covers: ["S-032"] },
    async () => {
      await setCaption(page, "Opening API Status...");
      await guarded.click(guarded.getByRole("button", { name: "Open account menu" }));
      await guarded.click(guarded.getByRole("menuitem", { name: "API Status" }));
      await expect(page).toHaveURL(/\/api-status$/);
      await expect(guarded.getByRole("heading", { name: "API & Project Status" })).toBeVisible();
      for (const service of ["Database", "Redis Cache", "ImageKit", "Brevo Email"]) {
        await expect(guarded.getByText(service, { exact: true })).toBeVisible();
      }
    },
  );

  await step(
    {
      id: "S-033",
      chapter: "B",
      role: "admin",
      name: "Admin Settings — confirmed no click-path entry point",
      covers: ["S-033"],
    },
    async () => {
      await setCaption(page, "Looking for a way into Admin Settings...");
      // Searched the whole rendered UI at this point in the journey —
      // sidebar, profile menu, dashboard Quick Access grid, top-bar search
      // results for "settings" — for any link to /admin/settings.
      await expect(guarded.locator('a[href="/admin/settings"]')).toHaveCount(0);
      await expect(guarded.getByRole("link", { name: "Admin Settings" })).toHaveCount(0);
      await guarded.typeHumanlike(guarded.getByPlaceholder("Search pages…"), "settings");
      const resultsPanel = guarded.locator("section").filter({ hasText: "Search results" });
      await expect(resultsPanel.getByRole("link")).toHaveCount(0);
      await guarded.clearHumanlike(guarded.getByPlaceholder("Search pages…"));
    },
  );

  // S-033b — bonus verification, not a narrative journey click: opens a
  // second tab (sharing Amara's session) to hit the route directly, proving
  // this is "unreachable by click" and not a broken route. gotoOnce's
  // one-navigation-per-tab rule is why this needs its own tab rather than a
  // second page.goto() on the main one.
  const settingsCheckPage = await page.context().newPage();
  const settingsCheckScreenshot = path.join(screenshotsDir, "S-033b.png");
  const settingsGuarded = wrapPage(settingsCheckPage);
  await timeline.time(
    {
      id: "S-033b",
      chapter: "B",
      role: "admin",
      name: "Admin Settings route loads directly (confirms: unreachable, not broken)",
      covers: ["S-033"],
    },
    path.relative(OUT_DIR, settingsCheckScreenshot),
    async () => {
      await settingsGuarded.gotoOnce("/admin/settings");
      await expect(settingsGuarded.getByRole("heading", { name: "System Settings" })).toBeVisible();
      await settingsCheckPage.screenshot({ path: settingsCheckScreenshot });
    },
  );
  await settingsCheckPage.close();

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
