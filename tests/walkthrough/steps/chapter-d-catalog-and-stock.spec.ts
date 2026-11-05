import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { wrapPage } from "../lib/guarded-page";
import { WalkthroughObservers } from "../observers";
import { installOverlay, setCaption } from "../lib/overlay";
import { Timeline, type TimelineStep } from "../lib/timeline";
import { FIRST_ADMIN, activateSelfRegisteredWalkthroughUser } from "../lib/seed-admin";

/**
 * Storyboard Chapter D (storyboard.md) — S-050 through S-066: Categories,
 * Suppliers, Warehouses, Products (including import/export/image-upload),
 * and stock allocation/transfer.
 *
 * Runs standalone, so it replays the tail of Chapter A/B's bootstrap
 * (register Folake, recover from ISS-0087, sign out, sign in as Amara)
 * unrecorded before the chapter's own timeline starts — see Chapter B's
 * file header for why. One addition Chapters A/B/C didn't need: task 0004's
 * decision (a) (built 2026-10-26, after those chapters) made self-
 * registration issue no session until email verification, so Folake's
 * bootstrap account is activated out-of-band here too — see
 * activateSelfRegisteredWalkthroughUser in lib/seed-admin.ts.
 *
 * FAB interaction note (confirmed live, not guessed): the right-edge
 * floating "Add Category"/"Add Supplier" buttons (components/shared/
 * FloatingActionButtons.tsx) start collapsed (icon-only); a plain click
 * lands mid-expand-animation and misses. A real person's cursor always
 * passes near a target before landing on it, so every FAB trigger here is
 * hovered briefly before the click, same spirit as typeHumanlike's
 * real-speed keystrokes. Likewise, a few bottom-of-page action buttons
 * (Transfer Stock, Import Products) need an explicit scroll into view —
 * a person scrolls to a control before clicking it as surely as they move
 * the cursor to it.
 */

const OUT_DIR =
  process.env.WALKTHROUGH_OUT_DIR ??
  path.join(process.cwd(), "out", "walkthrough-dev", "chapter-d");

const BASE_URL = "http://localhost:3100";
const THROWAWAY_PASSWORD = "Walkthrough#2026";

test("Chapter D — catalog and stock (admin)", async ({ page }) => {
  test.setTimeout(480_000);

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

  /** A FAB trigger starts collapsed; hover lets its expand animation settle before the click. */
  const clickFab = async (name: string) => {
    const fab = guarded.getByRole("button", { name, exact: true });
    await fab.hover();
    await page.waitForTimeout(400);
    await fab.click();
  };

  /**
   * Confirmed live (not guessed): a table row's first-ever click on a detail-page Link
   * sometimes races the dev server's Turbopack prefetch for that same href — the RSC
   * fetch completes (verified via network inspection: a real, valid text/x-component
   * payload, no redirect marker) but the App Router silently drops the navigation commit.
   * A second click to the same href always lands immediately (the prefetch is warm by
   * then), so this retries rather than guessing a fixed delay. Dev-mode/Turbopack-only
   * flakiness, not a product defect — a production build has no HMR/on-demand compile to
   * race against.
   */
  const clickAndWaitForUrl = async (
    locator: ReturnType<typeof guarded.getByRole>,
    urlPattern: RegExp,
  ) => {
    await locator.click();
    const landed = await page
      .waitForURL(urlPattern, { timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!landed) {
      await locator.click();
      await page.waitForURL(urlPattern, { timeout: 10_000 });
    }
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

  // Task 0004 decision (a) (built after Chapters A/B/C's bootstrap was written): self-
  // registration now creates PENDING_VERIFICATION and issues NO session at all — the old
  // "reload and you're already logged in" recovery depended on a cookie register used to set
  // regardless of status, which no longer happens. Folake's account is activated out-of-band
  // (see activateSelfRegisteredWalkthroughUser's doc comment), then — since there is now
  // nothing to "discover" via a reload — she logs in explicitly, right here on /login, same
  // as any other sign-in.
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

  // ---- Chapter D proper ----

  await step({ id: "S-050", chapter: "D", role: "admin", name: "Categories — Add validation, create Beverages + Snacks", covers: ["S-050"] }, async () => {
    await setCaption(page, "Opening Category Management...");
    await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Categories" }));
    await expect(page).toHaveURL(/\/categories$/);
    await observers.scanAccessibility(page, "/categories");

    await setCaption(page, "Opening Add Category...");
    await clickFab("Add Category");
    await expect(guarded.getByRole("dialog").getByRole("heading", { name: "Add Category" })).toBeVisible();

    // Amended (confirmed live, not guessed): the dialog has no inline "required" error text on
    // an empty submit — the Add Category button is simply disabled until a name is entered.
    const dialog = guarded.getByRole("dialog");
    const addBtn = dialog.getByRole("button", { name: "Add Category", exact: true });
    await expect(addBtn).toBeDisabled();

    await setCaption(page, "Creating Beverages...");
    await guarded.typeHumanlike(dialog.locator('input[placeholder="New Category"]'), "Beverages");
    await expect(addBtn).toBeEnabled();
    await guarded.click(addBtn);
    await expect(guarded.getByText('Category "Beverages" created successfully').first()).toBeVisible();

    // The dialog stays open and clears its fields after a successful create — adding another
    // category does not need the FAB reopened.
    await setCaption(page, "Creating Snacks, in the same still-open dialog...");
    await guarded.typeHumanlike(dialog.locator('input[placeholder="New Category"]'), "Snacks");
    await guarded.click(addBtn);
    await expect(guarded.getByText('Category "Snacks" created successfully').first()).toBeVisible();
    await guarded.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(guarded.getByRole("dialog")).toHaveCount(0);

    await expect(guarded.getByText("Beverages", { exact: true })).toBeVisible();
    await expect(guarded.getByText("Snacks", { exact: true })).toBeVisible();
  });

  await step({ id: "S-051", chapter: "D", role: "admin", name: "Edit Snacks description, open detail, filter Active/Inactive", covers: ["S-051"] }, async () => {
    const snacksRow = guarded.locator("table tbody tr").filter({ hasText: "Snacks" });
    await setCaption(page, "Editing Snacks' description from the row menu...");
    await guarded.click(snacksRow.getByRole("button", { name: "Open menu" }));
    await guarded.click(guarded.getByRole("menuitem", { name: "Edit" }));
    const editDialog = guarded.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit Category" })).toBeVisible();
    await guarded.typeHumanlike(
      editDialog.locator("textarea").first(),
      "Chips, crackers and other snack foods.",
    );
    await guarded.click(editDialog.getByRole("button", { name: "Save Changes" }));
    await expect(guarded.getByText('Category "Snacks" updated successfully').first()).toBeVisible();
    // The dialog's closing animation leaves its overlay capturing clicks for a moment —
    // wait for it to fully unmount before clicking anything underneath it.
    await expect(guarded.getByRole("dialog")).toHaveCount(0);

    await setCaption(page, "Opening Snacks' detail page...");
    await clickAndWaitForUrl(guarded.getByRole("link", { name: "Snacks" }), /\/categories\/[^/]+$/);
    await expect(page).toHaveURL(/\/categories\/[^/]+$/);
    await expect(guarded.getByText("Chips, crackers and other snack foods.")).toBeVisible();
    await observers.scanAccessibility(page, "/categories/[id]");
    await guarded.goBack();
    await expect(page).toHaveURL(/\/categories$/);

    // Amended (confirmed live, not guessed): this is a Select ("All Categories" trigger,
    // role=combobox), not a filter-chip button named "Status" — picking an option closes it,
    // no second click needed.
    await setCaption(page, "Filtering categories by status...");
    // .first() — the page also has a "Rows per page" combobox further down; this one (the
    // status filter) is the first in DOM order.
    const statusFilter = guarded.getByRole("combobox").first();
    await guarded.click(statusFilter);
    await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Inactive" }));
    await expect(guarded.getByText("Beverages", { exact: true })).toHaveCount(0);
    await guarded.click(statusFilter);
    await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "All Categories" }));
    await expect(guarded.getByText("Beverages", { exact: true })).toBeVisible();
  });

  await step({ id: "S-052", chapter: "D", role: "admin", name: "Suppliers — Add validation, create Lagos Fresh Foods", covers: ["S-052"] }, async () => {
    await setCaption(page, "Opening Supplier Management...");
    await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Suppliers" }));
    await expect(page).toHaveURL(/\/suppliers$/);
    await observers.scanAccessibility(page, "/suppliers");

    await setCaption(page, "Opening Add Supplier...");
    await clickFab("Add Supplier");
    const dialog = guarded.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Supplier" })).toBeVisible();
    const addBtn = dialog.getByRole("button", { name: "Add Supplier", exact: true });
    await expect(addBtn).toBeDisabled();

    await setCaption(page, "Creating Lagos Fresh Foods...");
    await guarded.typeHumanlike(dialog.locator("input").first(), "Lagos Fresh Foods");
    await expect(addBtn).toBeEnabled();
    await guarded.click(addBtn);
    await expect(guarded.getByText('Supplier "Lagos Fresh Foods" created successfully').first()).toBeVisible();
    await guarded.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(guarded.getByRole("dialog")).toHaveCount(0);
    await expect(guarded.getByRole("link", { name: "Lagos Fresh Foods" })).toBeVisible();
  });

  await step({ id: "S-053", chapter: "D", role: "admin", name: "Supplier detail page (empty product grid)", covers: ["S-053"] }, async () => {
    await setCaption(page, "Opening Lagos Fresh Foods' detail page...");
    await clickAndWaitForUrl(guarded.getByRole("link", { name: "Lagos Fresh Foods" }), /\/suppliers\/[^/]+$/);
    await expect(page).toHaveURL(/\/suppliers\/[^/]+$/);
    await expect(guarded.getByText("Lagos Fresh Foods").first()).toBeVisible();
    await observers.scanAccessibility(page, "/suppliers/[id]");
  });

  await step({ id: "S-054", chapter: "D", role: "admin", name: "Warehouses — Add validation, create Main Warehouse + Overflow Depot", covers: ["S-054"] }, async () => {
    await setCaption(page, "Opening Warehouse Management...");
    await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Warehouses" }));
    await expect(page).toHaveURL(/\/admin\/warehouses$/);
    await observers.scanAccessibility(page, "/admin/warehouses");

    await setCaption(page, "Opening Add Warehouse...");
    await clickFab("Add Warehouse");
    let dialog = guarded.getByRole("dialog");
    // Amended (confirmed live): the submit button reads "Create Warehouse", not "Add
    // Warehouse" — only the page-level trigger uses "Add".
    let createBtn = dialog.getByRole("button", { name: "Create Warehouse" });
    await expect(createBtn).toBeDisabled();

    await setCaption(page, "Creating Main Warehouse...");
    await guarded.typeHumanlike(dialog.locator("input").first(), "Main Warehouse");
    const typeSelect = dialog.locator("#warehouse-type");
    await guarded.click(typeSelect);
    await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Main Warehouse" }));
    await expect(createBtn).toBeEnabled();
    await guarded.click(createBtn);
    await expect(guarded.getByText('Warehouse "Main Warehouse" created successfully').first()).toBeVisible();
    // This dialog closes on success (unlike Category/Supplier) — reopen the FAB.
    await expect(guarded.getByRole("dialog")).toHaveCount(0);

    // Amended (confirmed live, not guessed): the type list has no literal "Overflow" option
    // ("Main Warehouse", "Secondary", "Storage", "Distribution Center", "Retail Store",
    // "Other") — the second warehouse uses the "Secondary" type instead.
    await setCaption(page, "Creating Overflow Depot...");
    await clickFab("Add Warehouse");
    dialog = guarded.getByRole("dialog");
    createBtn = dialog.getByRole("button", { name: "Create Warehouse" });
    await guarded.typeHumanlike(dialog.locator("input").first(), "Overflow Depot");
    await guarded.click(dialog.locator("#warehouse-type"));
    await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Secondary" }));
    await guarded.click(createBtn);
    await expect(guarded.getByText('Warehouse "Overflow Depot" created successfully').first()).toBeVisible();

    await expect(guarded.getByText("Main Warehouse").first()).toBeVisible();
    await expect(guarded.getByText("Overflow Depot").first()).toBeVisible();
  });

  await step({ id: "S-055", chapter: "D", role: "admin", name: "Main Warehouse detail (empty stock)", covers: ["S-055"] }, async () => {
    await setCaption(page, "Opening Main Warehouse's detail page...");
    await clickAndWaitForUrl(guarded.getByRole("link", { name: "Main Warehouse" }), /\/admin\/warehouses\/[^/]+$/);
    await expect(page).toHaveURL(/\/admin\/warehouses\/[^/]+$/);
    await expect(guarded.getByText("Main Warehouse").first()).toBeVisible();
    await expect(guarded.getByText("No stock allocated to this warehouse yet")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/warehouses/[id]");
    await guarded.goBack();
    await expect(page).toHaveURL(/\/admin\/warehouses$/);
  });

  await step(
    {
      id: "S-056",
      chapter: "D",
      role: "admin",
      name: "Products — Add validation, create Zobo Drink 500ml, duplicate SKU",
      covers: ["S-056"],
    },
    async () => {
      await setCaption(page, "Opening Product Inventory Management...");
      await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Products" }));
      await expect(page).toHaveURL(/\/admin\/products$/);
      await observers.scanAccessibility(page, "/admin/products");

      await setCaption(page, "Opening Add Product...");
      await clickFab("Add Product");
      const dialog = guarded.getByRole("dialog");
      const addBtn = dialog.getByRole("button", { name: "Add Product", exact: true });
      await expect(addBtn).toBeDisabled();

      await setCaption(page, "Filling in the product's name, SKU, quantity and price...");
      await guarded.typeHumanlike(dialog.locator("#product-name"), "Zobo Drink 500ml");
      await guarded.typeHumanlike(dialog.locator("#sku"), "ZOB-500");
      await guarded.typeHumanlike(dialog.locator("#quantity"), "100");
      // Amended (confirmed live, not guessed): the price input blocks a minus sign as it's
      // typed (react-number-format's allowNegative={false}) — a negative price cannot
      // actually be entered, so there is no negative-price validation message to see.
      const priceInput = dialog.locator("#price");
      await guarded.typeHumanlike(priceInput, "-350.00");
      await expect(priceInput).toHaveValue("350.00");
      await expect(addBtn).toBeDisabled();

      await setCaption(page, "Selecting a category and supplier...");
      const comboboxes = dialog.getByRole("combobox");
      await guarded.click(comboboxes.nth(0));
      await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Beverages" }));
      await guarded.click(comboboxes.nth(1));
      await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Lagos Fresh Foods" }));
      await expect(addBtn).toBeEnabled();

      await setCaption(page, "Creating the product...");
      await guarded.click(addBtn);
      await expect(guarded.getByText('Product "Zobo Drink 500ml" created successfully').first()).toBeVisible();
      await expect(guarded.getByRole("dialog")).toHaveCount(0);
      await expect(guarded.getByText("Zobo Drink 500ml").first()).toBeVisible();

      await setCaption(page, "Trying to reuse the same SKU on a second product...");
      await clickFab("Add Product");
      const dialog2 = guarded.getByRole("dialog");
      await guarded.typeHumanlike(dialog2.locator("#sku"), "ZOB-500");
      await expect(dialog2.getByText(/SKU is already used/i)).toBeVisible();
      await expect(dialog2.getByRole("button", { name: "Add Product", exact: true })).toBeDisabled();
      await guarded.click(dialog2.getByRole("button", { name: "Cancel" }));
      await expect(guarded.getByRole("dialog")).toHaveCount(0);
    },
  );

  await step({ id: "S-057", chapter: "D", role: "admin", name: "Product detail page; QR code not configured", covers: ["S-057"] }, async () => {
    await setCaption(page, "Opening Zobo Drink 500ml's detail page...");
    const zoboLink = guarded.getByRole("link", { name: "Zobo Drink 500ml" });
    await clickAndWaitForUrl(
      zoboLink.getByText("Zobo Drink 500ml", { exact: true }),
      /\/admin\/products\/[^/]+$/,
    );
    await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/);
    await expect(guarded.getByRole("heading", { name: "QR Code / Barcode" })).toBeVisible();
    // Amended (confirmed live, not guessed, consistent with D6): ImageKit is not configured
    // here, so no product ever has a qrCodeUrl — the card shows "No QR code available" rather
    // than an image with a copy/download action.
    await expect(guarded.getByText("No QR code available")).toBeVisible();
    await observers.scanAccessibility(page, "/admin/products/[id]");
  });

  await step({ id: "S-058", chapter: "D", role: "admin", name: "Edit product quantity to 8 — low-stock indicator", covers: ["S-058"] }, async () => {
    await setCaption(page, "Editing the product to lower its quantity...");
    await guarded.click(guarded.getByRole("button", { name: "Edit Product" }));
    const dialog = guarded.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Update Product" })).toBeVisible();
    await guarded.clearHumanlike(dialog.locator("#quantity"));
    await guarded.typeHumanlike(dialog.locator("#quantity"), "8");
    await guarded.click(dialog.getByRole("button", { name: "Update Product" }));
    await expect(guarded.getByText('Product "Zobo Drink 500ml" updated successfully').first()).toBeVisible();
    await expect(guarded.getByText("Stock Low", { exact: false }).first()).toBeVisible();

    await guarded.goBack();
    await expect(page).toHaveURL(/\/admin\/products$/);
    const zoboRow = guarded.locator("table tbody tr").filter({ hasText: "Zobo Drink 500ml" });
    await expect(zoboRow.getByText("Stock Low", { exact: false })).toBeVisible();
  });

  await step(
    {
      id: "S-059",
      chapter: "D",
      role: "admin",
      name: "Import products — wrong file type, then a mixed CSV (ISS-0086, fixed this chapter)",
      covers: ["S-059"],
    },
    async () => {
      const importBtn = guarded.getByRole("button", { name: "Import Products" });
      await importBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      await setCaption(page, "Trying to import a file that isn't a spreadsheet...");
      await guarded.click(importBtn);
      let dialog = guarded.getByRole("dialog");
      await guarded.chooseFile(
        dialog.locator('input[type="file"]'),
        "tests/walkthrough/fixtures/not-a-product-file.txt",
      );
      // Confirmed live, not guessed: this is a toast (document body level), not inline in the
      // dialog.
      await expect(guarded.getByText("Invalid File Type").first()).toBeVisible();
      await guarded.click(dialog.getByRole("button", { name: "Cancel" }));
      await expect(guarded.getByRole("dialog")).toHaveCount(0);

      // Two fixes landed as part of this chapter's own audit loop. ISS-0086: the import route
      // validated every row against a schema requiring categoryId/supplierId/userId, fields
      // its own column mapping never produced, so every row failed regardless of content — see
      // lib/validations/product.ts's productImportRowSchema. A second, related bug the fix
      // surfaced: failCount started at 0 and only grew inside the per-row processing loop, so
      // the 2 rows that fail Zod validation itself (blank name, negative price) were listed in
      // `errors` but never counted — a real 6-of-8 result reported failedRows: 0, which also
      // meant ProductImportDialog.tsx's "close automatically if failedRows === 0" fired on a
      // result that was not actually all-success (app/api/products-import/route.ts, failCount
      // now seeded from validationResult.errors.length). Amended from the storyboard's
      // original "expect 0 of 8 imported": the fixture's 6 well-formed rows (one of which,
      // ZOB-500's SKU twin "Ginger Beer 330ml" etc., is new) now import; its 2
      // deliberately-invalid rows still fail, for their real reasons, correctly counted.
      await setCaption(page, "Importing a CSV with 6 good rows and 2 deliberately bad ones...");
      await importBtn.scrollIntoViewIfNeeded();
      await guarded.click(importBtn);
      dialog = guarded.getByRole("dialog");
      await guarded.chooseFile(
        dialog.locator('input[type="file"]'),
        "tests/walkthrough/fixtures/products-import.csv",
      );
      await expect(dialog.getByText("Total Rows: 8")).toBeVisible({ timeout: 15_000 });
      await expect(dialog.getByText("Successful: 6")).toBeVisible();
      await expect(dialog.getByText("Failed: 2")).toBeVisible();
      await expect(dialog.getByText(/Product name is required/i)).toBeVisible();
      await expect(dialog.getByText(/Price cannot be negative/i)).toBeVisible();
      // .first() — the dialog's X icon button also has an accessible name of "Close".
      await guarded.click(dialog.getByRole("button", { name: "Close" }).first());
      await expect(guarded.getByRole("dialog")).toHaveCount(0);
      await expect(guarded.getByText("Ginger Beer 330ml")).toBeVisible();
    },
  );

  await step({ id: "S-060", chapter: "D", role: "admin", name: "Activity History — the import entry and its detail", covers: ["S-060"] }, async () => {
    await setCaption(page, "Opening Activity History...");
    await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Activity History" }));
    await expect(page).toHaveURL(/\/admin\/activity-history$/);
    await observers.scanAccessibility(page, "/admin/activity-history");
    const importRow = guarded.locator("table tbody tr").filter({ hasText: "products-import.csv" });
    await expect(importRow).toBeVisible();

    // Amended (confirmed live, not guessed): the file name is plain text, not a link — the
    // row's "View" action is what opens the detail page.
    await setCaption(page, "Opening the import's detail...");
    const viewLink = importRow.getByRole("link", { name: "View" });
    await viewLink.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await clickAndWaitForUrl(viewLink, /\/admin\/activity-history\/[^/]+$/);
    await expect(page).toHaveURL(/\/admin\/activity-history\/[^/]+$/);
    await expect(guarded.getByText("Total Rows:")).toBeVisible();
    await expect(guarded.getByText("Failed:")).toBeVisible();
    await guarded.goBack();
    await expect(page).toHaveURL(/\/admin\/activity-history$/);
  });

  await step({ id: "S-061", chapter: "D", role: "admin", name: "Export Products (CSV and Excel)", covers: ["S-061"] }, async () => {
    await setCaption(page, "Back to Products, exporting as CSV...");
    await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Products" }));
    await expect(page).toHaveURL(/\/admin\/products$/);

    const exportBtn = guarded.getByRole("button", { name: "Export Products" });
    await guarded.click(exportBtn);
    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      guarded.click(guarded.getByRole("menuitem", { name: /CSV/i })),
    ]);
    expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/i);

    await setCaption(page, "Exporting as Excel...");
    await guarded.click(exportBtn);
    const [excelDownload] = await Promise.all([
      page.waitForEvent("download"),
      guarded.click(guarded.getByRole("menuitem", { name: /Excel/i })),
    ]);
    expect(excelDownload.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  await step(
    {
      id: "S-062",
      chapter: "D",
      role: "admin",
      name: "Product image upload — ImageKit not configured",
      covers: ["S-062"],
    },
    async () => {
      await setCaption(page, "Trying to upload a product image...");
      await clickFab("Add Product");
      const dialog = guarded.getByRole("dialog");
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        guarded.click(dialog.getByRole("button", { name: "Upload Image" })),
      ]);
      await fileChooser.setFiles("tests/walkthrough/fixtures/product-image.png");
      // Confirmed live, not guessed (D6): with ImageKit unconfigured, this is a clear,
      // visible failure toast, not a silent one.
      await expect(guarded.getByText("Upload Failed").first()).toBeVisible();
      await expect(guarded.getByText(/ImageKit credentials are missing/i).first()).toBeVisible();
      await guarded.click(dialog.getByRole("button", { name: "Cancel" }));
      await expect(guarded.getByRole("dialog")).toHaveCount(0);
    },
  );

  await step(
    {
      id: "S-063",
      chapter: "D",
      role: "admin",
      name: "Warehouse detail → Allocate stock (over limit, then valid)",
      covers: ["S-063"],
    },
    async () => {
      await setCaption(page, "Back to Main Warehouse's detail page...");
      await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Warehouses" }));
      await expect(page).toHaveURL(/\/admin\/warehouses$/);
      await clickAndWaitForUrl(guarded.getByRole("link", { name: "Main Warehouse" }), /\/admin\/warehouses\/[^/]+$/);
      await expect(page).toHaveURL(/\/admin\/warehouses\/[^/]+$/);

      await setCaption(page, "Opening Allocate Stock...");
      await guarded.click(guarded.getByRole("button", { name: "Allocate Stock" }));
      const dialog = guarded.getByRole("dialog");
      await guarded.click(dialog.getByRole("combobox"));
      await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Zobo Drink" }));

      await setCaption(page, "Trying to allocate more than is in stock...");
      const qtyInput = page.locator("#alloc-qty");
      await guarded.typeHumanlike(qtyInput, "999");
      await expect(dialog.getByText(/unit\(s\) available/i)).toBeVisible();
      const saveBtn = dialog.getByRole("button", { name: "Save allocation" });
      await expect(saveBtn).toBeDisabled();

      await setCaption(page, "Allocating a valid quantity instead...");
      await guarded.clearHumanlike(qtyInput);
      await guarded.typeHumanlike(qtyInput, "5");
      await expect(saveBtn).toBeEnabled();
      await guarded.click(saveBtn);
      await expect(guarded.getByText("Stock allocation saved").first()).toBeVisible();
      // Amended (confirmed live, not guessed): AllocateStockDialog closes itself on a
      // successful save (its onSuccess calls handleOpenChange(false)) — same pattern as
      // Warehouse creation above, unlike Category/Supplier which stay open. No Cancel click
      // needed or possible; the button is already gone by the time this would run.
      await expect(guarded.getByRole("dialog")).toHaveCount(0);
    },
  );

  await step(
    {
      id: "S-064",
      chapter: "D",
      role: "admin",
      name: "Transfer stock to Overflow Depot (over available, then valid)",
      covers: ["S-064"],
    },
    async () => {
      const transferBtn = guarded.getByRole("button", { name: "Transfer Stock" });
      await transferBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await setCaption(page, "Opening Transfer Stock...");
      await guarded.click(transferBtn);
      const dialog = guarded.getByRole("dialog");
      const comboboxes = dialog.getByRole("combobox");
      await guarded.click(comboboxes.nth(0));
      await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Zobo Drink" }));
      await guarded.click(comboboxes.nth(1));
      await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Overflow Depot" }));

      await setCaption(page, "Trying to transfer more than is allocated here...");
      const qtyInput = dialog.locator("input[type='number']").last();
      await guarded.typeHumanlike(qtyInput, "999");
      const transferSubmit = dialog.getByRole("button", { name: "Transfer", exact: true });
      await expect(transferSubmit).toBeDisabled();

      await setCaption(page, "Transferring a valid quantity...");
      await guarded.clearHumanlike(qtyInput);
      await guarded.typeHumanlike(qtyInput, "2");
      await expect(transferSubmit).toBeEnabled();
      await guarded.click(transferSubmit);
      // This is /api/stock-transfers' first-ever hit in the run — Turbopack dev mode compiles
      // routes on demand, and a cold compile here can run well past the default 5s timeout
      // (confirmed live: the dev server log showed "Compiling /api/stock-transfers ..." still
      // in progress at the moment a 5s assertion failed).
      await expect(guarded.getByText(/transferred/i).first()).toBeVisible({ timeout: 45_000 });
    },
  );

  await step(
    {
      id: "S-065",
      chapter: "D",
      role: "admin",
      name: "Edit an allocation; delete one (dismiss, then confirm)",
      covers: ["S-065"],
    },
    async () => {
      await setCaption(page, "Editing the Zobo Drink allocation...");
      // Amended (confirmed live, not guessed): warehouse stock rows
      // (WarehouseStockAllocationRow.tsx) are plain cards, not a <table> — there's no row
      // locator to scope to. Each row's Edit/Remove icon buttons carry an aria-label naming
      // the product directly, which is unambiguous on its own.
      await guarded.click(guarded.getByRole("button", { name: "Edit allocation for Zobo Drink 500ml" }));
      const editDialog = guarded.getByRole("dialog");
      await expect(editDialog.getByText("Update Allocation")).toBeVisible();
      const editQty = editDialog.locator("#alloc-qty");
      await guarded.clearHumanlike(editQty);
      await guarded.typeHumanlike(editQty, "3");
      await guarded.click(editDialog.getByRole("button", { name: "Save changes" }));
      // PUT /api/stock-allocations/[id]'s first-ever hit in the run — same cold-compile
      // margin as S-064's /api/stock-transfers (confirmed live: 5.1s response against the
      // default 5s timeout).
      await expect(guarded.getByText("Allocation updated").first()).toBeVisible({ timeout: 45_000 });
      await expect(guarded.getByRole("dialog")).toHaveCount(0);

      await setCaption(page, "Deleting the allocation — dismiss first...");
      await guarded.click(guarded.getByRole("button", { name: "Remove allocation for Zobo Drink 500ml" }));
      const confirmDialog = guarded.getByRole("alertdialog");
      await expect(confirmDialog.getByText("Remove warehouse allocation?")).toBeVisible();
      await guarded.click(confirmDialog.getByRole("button", { name: "Cancel" }));
      await expect(confirmDialog).toHaveCount(0);

      await setCaption(page, "Deleting the allocation — confirm this time...");
      await guarded.click(guarded.getByRole("button", { name: "Remove allocation for Zobo Drink 500ml" }));
      await guarded.click(guarded.getByRole("alertdialog").getByRole("button", { name: "Remove" }));
      // DELETE /api/stock-allocations/[id]'s first-ever hit — same cold-compile margin.
      await expect(guarded.getByText("Allocation removed").first()).toBeVisible({ timeout: 45_000 });
    },
  );

  await step(
    {
      id: "S-066",
      chapter: "D",
      role: "admin",
      name: "Create a throwaway product and delete it",
      covers: ["S-066"],
    },
    async () => {
      await setCaption(page, "Back to Products, creating a throwaway product...");
      await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Products" }));
      await expect(page).toHaveURL(/\/admin\/products$/);
      await clickFab("Add Product");
      const dialog = guarded.getByRole("dialog");
      await guarded.typeHumanlike(dialog.locator("#product-name"), "Throwaway Widget");
      await guarded.typeHumanlike(dialog.locator("#sku"), "THROWAWAY-01");
      await guarded.typeHumanlike(dialog.locator("#quantity"), "1");
      await guarded.typeHumanlike(dialog.locator("#price"), "1.00");
      const comboboxes = dialog.getByRole("combobox");
      await guarded.click(comboboxes.nth(0));
      await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Beverages" }));
      await guarded.click(comboboxes.nth(1));
      await guarded.click(page.locator('[role="option"]:visible').filter({ hasText: "Lagos Fresh Foods" }));
      await guarded.click(dialog.getByRole("button", { name: "Add Product", exact: true }));
      await expect(guarded.getByText('Product "Throwaway Widget" created successfully').first()).toBeVisible();
      await expect(guarded.getByText("Throwaway Widget").first()).toBeVisible();

      await setCaption(page, "Deleting it, confirming the dialog...");
      const throwawayLink = guarded.getByRole("link", { name: "Throwaway Widget" });
      await clickAndWaitForUrl(
        throwawayLink.getByText("Throwaway Widget", { exact: true }),
        /\/admin\/products\/[^/]+$/,
      );
      await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/);
      await guarded.click(guarded.getByRole("button", { name: "Delete Product" }));
      const confirmDialog = guarded.getByRole("alertdialog");
      await guarded.click(confirmDialog.getByRole("button", { name: "Delete", exact: true }));
      // Amended (confirmed live, not guessed): a successful product delete navigates to "/"
      // (ProductDetailPage.tsx's handleConfirmDeleteProduct calls navigateTo("/")), same
      // pattern as supplier delete — not back to the products list. DELETE
      // /api/products/[id]'s first-ever hit also gets the same cold-compile margin as above.
      await page.waitForURL(`${BASE_URL}/`, { timeout: 45_000 });

      await setCaption(page, "Confirming it stays gone after navigating away and back...");
      await guarded.click(guarded.getByRole("navigation").getByRole("link", { name: "Products" }));
      await expect(page).toHaveURL(/\/admin\/products$/);
      await expect(guarded.getByText("Throwaway Widget")).toHaveCount(0);
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
