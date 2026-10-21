# Walkthrough storyboard — Octalve IMS, FULL_PRODUCT (Phase 0 draft)

One continuous journey. Every step is a human action (click, type with real key presses, choose a file in the file dialog, follow a link, back/forward, sign out, sign in as another person) followed by a hard assertion on what the person can see. Nothing is reached by URL after the first page load.

**Basis column:** `R` = the expected result is read from code or docs; `A` = assumed, to be pinned down at the first run (the assertion is then written to the observed *correct* behaviour, or the difference becomes a finding). Steps tagged `module` count toward coverage; this is FULL_PRODUCT, so there is no `setup` chapter and no `boundary` tag.

**Fictional data (throwaway):** password for every account `Walkthrough#2026`; domain `walkthrough.test`.

| Person | Role | How created | Entry after sign-in |
|---|---|---|---|
| Amara Okafor `amara.okafor@` | admin ("store owner") | the `/register` screen (every self-registration is an admin) | `/` |
| Kemi Adeyemi `kemi.adeyemi@` | supplier | admin, User Management → Create User | `/supplier` |
| Chidi Eze `chidi.eze@` | client | admin, User Management → Create User | `/client` |
| Bisi Lawal `bisi.lawal@` | client (second, for isolation checks) | same | `/client` |
| Tunde Bello `tunde.bello@` | retailer | same | `/` (no dedicated portal) |
| Ngozi Obi `ngozi.obi@` | user (throwaway, deleted in S-047) | same | n/a |

**Fixtures to create in Phase 1** (`tests/walkthrough/fixtures/`, fictional): `products-import.csv` (header per the import dialog: Product Name, SKU, Price, Quantity, Status, …; 6 valid rows and 2 invalid), `not-a-product-file.txt`, `product-image.png`.

## Chapter A — First screen and authentication (anonymous)

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-001 | anonymous | First page load: open `BASE_URL/` | Redirected to `/login`; login form, demo-account select, Google button, "Create account" link all visible | module | R |
| S-002 | anonymous | Click Sign in with both fields empty | Inline validation messages for email and password; stays on `/login` | module | R |
| S-003 | anonymous | Type an unknown email and a password, click Sign in | An error message is shown; the page does not reload and the form keeps its values (known risk: the refresh interceptor reloads the page, see review) | module | A |
| S-004 | anonymous | Choose "Admin" in the demo-account select, click Sign in | Credentials pre-fill; sign-in fails because that account does not exist in a fresh database. Assert the dead end and record it | module | A |
| S-005 | anonymous | Click "Forgot password", click Send with empty field, then type an unknown email and send | `/forgot-password`; validation error, then a generic "if an account exists…" confirmation | module | R |
| S-006 | anonymous | Back to login, click "Create account" | `/register` form visible | module | R |
| S-007 | anonymous | Submit empty; then type an invalid email; then a 5-character password | A validation message for each case | module | R |
| S-008 | anonymous | Register Amara Okafor with a valid email and password | Account created; app lands on `/login` or signs the person in (confirm which, then assert it) | module | A |
| S-009 | admin | Sign in as Amara, leave "Keep me signed in" unchecked | Lands on `/`; welcome toast; sidebar visible | module | R |

## Chapter B — Admin's first look (empty database)

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-010 | admin | Look at the dashboard `/` | Stat cards show zero, Quick Access grid lists the sections | module | R |
| S-011 | admin | Click sidebar → Store Overview | Page loads with zero-data state | module | R |
| S-012 | admin | Click Business Insights | Empty-state charts/tabs | module | A |
| S-013 | admin | Click Orders | Empty orders list with an empty-state message | module | R |
| S-014 | admin | Click Invoices | Empty invoices list | module | R |
| S-015 | admin | Click Support Tickets | Empty tickets list | module | R |
| S-016 | admin | Click Product Reviews | Empty reviews list | module | R |
| S-017 | admin | Click Products | Empty products list, Add/Import/Export controls | module | R |
| S-018 | admin | Click Categories | Empty list | module | R |
| S-019 | admin | Click Suppliers | Empty list | module | R |
| S-020 | admin | Click Warehouses | Empty list | module | R |
| S-021 | admin | Click Supplier Portal | Empty supplier-portal overview | module | A |
| S-022 | admin | Click Client Portal | Empty client-portal overview | module | A |
| S-023 | admin | Click User Management | One user (Amara) listed | module | R |
| S-024 | admin | Click Activity History | Registration/login entries or empty state | module | A |
| S-025 | admin | Click My Activity | Personal-only empty state | module | R |
| S-026 | admin | Click the top-bar search, type `ware`, click the "Warehouses" result | Result list filters as typed; click lands on Warehouses | module | R |
| S-027 | admin | Click the theme toggle (to dark, back to light); collapse and expand the sidebar | Theme changes both ways and persists across a page change; sidebar collapses | module | R |
| S-028 | admin | Click the notification bell | Dropdown opens with an empty state | module | R |
| S-029 | admin | Open the profile menu → Support Tickets | `/support-tickets` loads | module | R |
| S-030 | admin | Profile menu → Email Preferences; toggle one option, save; click away and come back | Saved confirmation; the toggle is still set after returning | module | A |
| S-031 | admin | Profile menu → API Documentation | `/api-docs` loads with endpoint list | module | R |
| S-032 | admin | Profile menu → API Status | `/api-status` shows health probes; unconfigured integrations are shown as such | module | A |
| S-033 | admin | Find and click the entry to Admin Settings (system config/colour palette) | Settings screen loads. If no click path exists, that is a finding (feature with no entry point) | module | A |

## Chapter C — People (User Management)

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-040 | admin | User Management → Create User → submit empty | Validation messages | module | R |
| S-041 | admin | Create Kemi Adeyemi with role Supplier | Success toast; Kemi listed with a Supplier badge | module | R |
| S-042 | admin | Create Chidi Eze and Bisi Lawal with role Client | Both listed with Client badges | module | R |
| S-043 | admin | Create Tunde Bello with role Retailer | Listed with Retailer badge | module | R |
| S-044 | admin | Create Ngozi Obi with role User | Listed with User badge | module | R |
| S-045 | admin | Filter by role Client, clear filter, search "Kemi" | List filters and resets correctly | module | R |
| S-046 | admin | Open Chidi's detail page; click Edit, change nothing, cancel; open and close the delete dialog without confirming | Detail shows overview; dialogs cancel cleanly | module | A |
| S-047 | admin | Delete Ngozi: click Delete, dismiss by clicking outside the dialog, click Delete again, confirm; then navigate away and back | Dialog dismisses on outside click; user removed; still gone after returning | module | R |

## Chapter D — Catalog and stock (admin)

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-050 | admin | Categories → Add: submit empty; then create "Beverages" and "Snacks" | Validation, then both listed | module | R |
| S-051 | admin | Edit "Snacks" description; open its detail page; filter Active/Inactive | Edit persists; detail renders; filter works | module | R |
| S-052 | admin | Suppliers → Add: submit empty; then create "Lagos Fresh Foods" | Validation, then listed | module | R |
| S-053 | admin | Open the supplier's detail page | Detail renders with product grid (empty) | module | R |
| S-054 | admin | Warehouses → Add: submit empty; then create "Main Warehouse" (main) and "Overflow Depot" (overflow) | Validation, then both listed | module | R |
| S-055 | admin | Open Main Warehouse detail | Detail with empty stock | module | R |
| S-056 | admin | Products → Add: try without category; with a negative price; then create "Zobo Drink 500ml" (SKU ZOB-500, 350.00, qty 100, expiry date); then try another with the same SKU | Validation on each bad case; product listed; duplicate SKU refused with a clear message | module | R |
| S-057 | admin | Open the product's detail page; click QR code copy/download | Detail shows stock, QR image, insights | module | R |
| S-058 | admin | Edit the product: lower quantity to 8; save | Persists; low-stock indicator appears on the list and dashboard | module | R |
| S-059 | admin | Import products: choose `not-a-product-file.txt`; then choose `products-import.csv` | Wrong type refused; valid rows imported, invalid rows reported with reasons | module | R |
| S-060 | admin | Open Activity History → import history entry and its detail | Import appears with row counts | module | A |
| S-061 | admin | Click Export (CSV and Excel) on Products | A download starts for each | module | A |
| S-062 | admin | In the product dialog, choose `product-image.png` through the file dialog | With ImageKit unconfigured, a clear "image upload unavailable" message, not a silent failure (confirm; else finding) | module | A |
| S-063 | admin | Warehouse detail → Allocate stock: enter more than the product quantity; then a valid quantity | Validation message; allocation listed | module | R |
| S-064 | admin | Transfer stock to Overflow Depot: more than available; then a valid amount | Validation message; both warehouses show new quantities | module | R |
| S-065 | admin | Edit an allocation; delete one (dismiss, then confirm) | Quantities update; deletion confirmed by dialog | module | R |
| S-066 | admin | Create a throwaway product and delete it (hard delete, confirm) | Removed from list and detail; persists after navigating away | module | R |

## Chapter E — Supplier

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-070 | admin → anonymous | Click Logout; Cancel; click Logout again and confirm | Confirmation dialog; lands on `/login` with a goodbye toast | module | R |
| S-071 | supplier | Sign in as Kemi, tick "Keep me signed in" | Lands on `/supplier`; scoped KPIs at zero; monthly revenue chart; Pro upsell card | module | R |
| S-072 | supplier | Read the navigation | Exactly: Supplier Portal, My Products, View Orders, Related Invoices; assert absence of Warehouses, Categories, User Management, Business Insights, Product Reviews | module | R |
| S-073 | supplier | My Products → create "Palm Oil 1L" | Created; list shows only Kemi's products (not Amara's) | module | A |
| S-074 | supplier | View Orders; Related Invoices | Empty states; no create/confirm/ship/cancel controls | module | R |
| S-075 | supplier | Support Tickets → New: empty subject; then a ticket with priority High and related product | Validation, then ticket created and visible in the list | module | R |

## Chapter F — Client

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-080 | client | Sign out; sign in as Chidi | Lands on `/client`; empty snapshot | module | R |
| S-081 | client | Read the navigation | Exactly: Client Portal, Browse Products, My Orders, My Invoices | module | R |
| S-082 | client | Browse Products: filter by owner, category and search; open a product detail | Filters narrow the list; stock shown; no edit controls; approved reviews section empty | module | A |
| S-083 | client | Orders → New order: submit with no items; with quantity above stock | Validation; over-quantity blocked with the available amount | module | R |
| S-084 | client | Create an order with Zobo (qty 3) and Palm Oil (qty 2), fill the address, submit | Order appears as pending with total; detail shows both lines | module | R |
| S-085 | client | Create a second order (Zobo qty 1) | Listed as pending | module | R |
| S-086 | client | Open My Orders and each order detail | Status and payment badges visible | module | R |
| S-087 | client | Support Tickets → New ticket tied to the first order; post a reply | Ticket and reply shown | module | R |
| S-088 | client | Click the notification bell | Order notifications listed (or empty; confirm) | module | A |
| S-089 | client | Sign out; sign in as Bisi; open My Orders and My Invoices | Both empty: Chidi's order is not visible to her | module | R |

## Chapter G — Admin fulfilment

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-090 | admin | Sign out; sign in as Amara; read the sidebar badges | Pending order and ticket counts shown | module | R |
| S-091 | admin | Orders → open Chidi's first order; open Edit and close it | Detail with parties, lines, totals | module | R |
| S-092 | admin | Confirm the order | Status confirmed; reserved quantity visible on product and warehouse | module | R |
| S-093 | admin | Advance status to processing, shipped (enter tracking), delivered | Status badge and date update at each step | module | A |
| S-094 | admin | Invoices → create an invoice from the order (try a second invoice for the same order); open its detail; click PDF; click Send | Created; duplicate refused; PDF downloads; send reports the (unconfigured) email outcome clearly | module | A |
| S-095 | admin | Record a partial payment on the invoice, then the remainder | Status partial, then paid; order payment status follows | module | A |
| S-096 | admin | Open the second order and cancel it; then process refund (if offered) | Cancelled with a confirmation dialog; linked invoice shows cancelled | module | R |
| S-097 | admin | Support Tickets → open Chidi's ticket; reply; reassign; mark resolved; close | Each status badge updates; reply appears in the thread | module | R |

## Chapter H — Client after delivery

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-100 | client | Sign in as Chidi; open the delivered order and its invoice; click Pay | Delivered/paid statuses; Pay with Stripe unconfigured shows a clear message (decision D6) | module | A |
| S-101 | client | Write a review on a delivered product (try empty comment first); try on a product never ordered | Validation; review submitted as pending; ineligible product offers no review | module | R |
| S-102 | client | Reply on the ticket; open the bell, mark all read, delete one notification (confirm) | Reply shown; notifications update and persist | module | R |
| S-103 | client | Profile menu → Email Preferences; change and save | Persists after returning | module | A |

## Chapter I — Admin oversight

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-110 | admin | Product Reviews → approve one, reject another, open detail, delete one (confirm) | Status badges update; only approved reviews are public (check on product detail as client in S-082 variant) | module | R |
| S-111 | admin | Dashboard and Store Overview with data | Stat cards and charts reflect orders, revenue, stock | module | R |
| S-112 | admin | Business Insights: switch tabs including Warehouses; trigger AI insight | Charts with data; AI shows "unavailable" state, not an error overlay | module | A |
| S-113 | admin | Supplier Portal and Client Portal, open one supplier and one client | Populated overviews with the real orders and revenue | module | R |
| S-114 | admin | Activity History: open an entry's detail | Audit trail lists the registrations, creations and status changes performed above | module | R |
| S-115 | admin | My Activity | Personal orders and invoices | module | A |
| S-116 | admin | Delete a product that has order history, and one with an active order | Active order: blocked with a 409 message; history-only: archived (soft) message | module | R |

## Chapter J — Retailer

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-120 | retailer | Sign out; sign in as Tunde; read the navigation | Assert exactly what a retailer is meant to see. The code gives retailer the admin shell (no dedicated portal): record as a finding if admin-only items appear | module | A |
| S-121 | retailer | Open Products, Orders | View only (`can()` allows Products/Stock/Orders view); assert absence of create, edit and delete controls | module | A |

## Chapter K — Session behaviour and closing

| ID | Role | Human action | Expected visible result | Tag | Basis |
|---|---|---|---|---|---|
| S-132 | anonymous | Sign out; look at the production login screen | Records whether the demo-account select (shared password) ships in the production build | module | R |
| S-133 | anonymous | Enter a wrong password six times in a row for one account | A rate-limit message appears (needs Redis, decision D3) | module | A |
| S-134 | anonymous | After signing out, press the browser Back button | Login page or an empty shell; no private page content is shown | module | A |
| S-135 | any | (Evidence step, no extra action) | The timeline records at least one `POST /api/auth/refresh` returning 200 over the run, proving silent renewal across the 15-minute access token | module | A |
| S-136 | anonymous | `/register` with Amara's already-used email | A duplicate-email message; assert the wording | module | R |

## Not demonstrable here

See `coverage.yaml` rows `ND-02` to `ND-17` and the candidate findings `FND-01` to `FND-03`.

## Step → matrix rows (generated from `coverage.yaml`)

Run `node tests/walkthrough/tools/step-index.mjs` (Phase 1) to regenerate. Not hand-maintained.
