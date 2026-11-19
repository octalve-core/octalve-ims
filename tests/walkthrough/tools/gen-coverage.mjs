// One-off generator for tests/walkthrough/coverage.yaml (Phase 0). After generation the YAML is the
// source of truth and is edited by hand; this script is kept only as the record of how it was first built.
// Do NOT run it over tests/walkthrough/coverage.yaml: write to a new file and diff instead.
// Usage: node gen-coverage.mjs <inventory.json> <sourceCommit> > coverage.yaml
import fs from "node:fs";

const inv = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const commit = process.argv[3];

const A = "admin", S = "supplier", C = "client", R = "retailer", N = "anonymous";

// url -> [roles, steps, note?]
const PAGES = {
  "/login": [[N], "S-001,S-002,S-003,S-004,S-070"],
  "/register": [[N], "S-006,S-007,S-008"],
  "/forgot-password": [[N], "S-005"],
  "/reset-password": [[N], "ND-02", "needs the emailed token; no email catcher exists"],
  "/": [[A, R], "S-010", "client and supplier are redirected to /client and /supplier"],
  "/admin/dashboard-overall-insights": [[A, R], "S-011,S-111"],
  "/business-insights": [[A, R], "S-012,S-112"],
  "/admin/orders": [[A], "S-013,S-091"],
  "/admin/orders/[id]": [[A], "S-091,S-092,S-093,S-096"],
  "/admin/invoices": [[A], "S-014"],
  "/admin/invoices/[id]": [[A], "S-094,S-095"],
  "/admin/support-tickets": [[A], "S-015,S-097"],
  "/admin/support-tickets/[id]": [[A], "S-097"],
  "/admin/product-reviews": [[A], "S-016,S-110"],
  "/admin/product-reviews/[id]": [[A], "S-110"],
  "/admin/products": [[A], "S-017,S-056,S-059,S-061"],
  "/admin/products/[id]": [[A], "S-057,S-058,S-066"],
  "/categories": [[A], "S-018,S-050"],
  "/categories/[id]": [[A], "S-051"],
  "/admin/categories/[id]": [[A], "S-051", "confirm which of /categories/[id] and /admin/categories/[id] the list links to"],
  "/suppliers": [[A], "S-019,S-052"],
  "/suppliers/[id]": [[A], "S-053"],
  "/admin/suppliers/[id]": [[A], "S-053", "confirm which detail route the list links to"],
  "/admin/warehouses": [[A], "S-020,S-054"],
  "/admin/warehouses/[id]": [[A], "S-055,S-063,S-064,S-065"],
  "/admin/supplier-portal": [[A], "S-021,S-113"],
  "/admin/client-portal": [[A], "S-022,S-113"],
  "/admin/user-management": [[A], "S-023,S-040,S-041,S-042,S-043,S-044,S-045,S-047"],
  "/admin/user-management/[id]": [[A], "S-046"],
  "/admin/activity-history": [[A], "S-024,S-060,S-114"],
  "/admin/activity-history/[id]": [[A], "S-114"],
  "/admin/my-activity": [[A], "S-025,S-115"],
  "/admin/settings": [[A], "S-033", "find the click path; if none exists this is a finding (feature with no entry point)"],
  "/admin/settings/email-preferences": [[A], "S-030"],
  "/settings/email-preferences": [[A, S, C, R], "S-030,S-103"],
  "/support-tickets": [[A, S, C, R], "S-029,S-075,S-087"],
  "/support-tickets/[id]": [[A, S, C], "S-075,S-087,S-102"],
  "/api-docs": [[A, S, C, R], "S-031"],
  "/api-status": [[A, S, C, R], "S-032"],
  "/client": [[C], "S-080"],
  "/supplier": [[S], "S-071"],
  "/products": [[S, C, A], "S-073,S-082"],
  "/products/[id]": [[S, C], "S-082"],
  "/orders": [[S, C], "S-074,S-083,S-084,S-085,S-086"],
  "/orders/[id]": [[S, C], "S-084,S-100"],
  "/invoices": [[S, C], "S-074,S-100"],
  "/invoices/[id]": [[S, C], "S-100"],
  "/warehouses": [[], "ND-14", "no role has a nav link to it (admin uses /admin/warehouses); URL navigation is forbidden"],
  "/warehouses/[id]": [[], "ND-14", "same as /warehouses"],
  "/_not-found": [[N], "ND-04", "reachable only by typing a URL"],
};
const ALIAS_NOTE = "redirect-only alias; reachable by a human only if some link or notification points at it; else not-demonstrable";
for (const u of ["/admin", "/admin/insights", "/admin/history", "/admin/history/[id]", "/admin/client-orders", "/admin/client-orders/[id]",
  "/admin/client-invoices", "/admin/client-invoices/[id]", "/admin/personal-orders", "/admin/personal-orders/[id]",
  "/admin/personal-invoices", "/admin/personal-invoices/[id]"]) PAGES[u] = [[A], "S-090", ALIAS_NOTE];

// api url -> [steps, kind, note?]   kind: ui | nd | nosreen
const API = {
  "/api/auth/login": ["S-003,S-009", "ui"], "/api/auth/register": ["S-008", "ui"], "/api/auth/logout": ["S-070", "ui"],
  "/api/auth/session": ["S-009,S-010", "ui"], "/api/auth/refresh": ["S-135", "ui", "exercised by elapsed time (15-minute access token) and checked in the timeline: at least one POST 200"],
  "/api/auth/forgot-password": ["S-005", "ui"], "/api/auth/reset-password": ["ND-02", "nd", "needs the emailed token"],
  "/api/auth/verify-email": ["ND-05", "nd", "reached from an emailed link; nothing in the app creates a verification token"],
  "/api/auth/change-password": ["FND-01", "nosreen", "no client code references it: there is no change-password screen"],
  "/api/auth/oauth/google": ["ND-06", "nd", "needs Google OAuth credentials and Google's consent screen"],
  "/api/auth/oauth/google/callback": ["ND-06", "nd", "same"],
  "/api/admin/client-orders": ["S-013", "ui"], "/api/admin/client-invoices": ["S-014", "ui"], "/api/admin/counts": ["S-090", "ui", "sidebar badges"],
  "/api/ai/insights": ["S-112", "ui", "AI keys absent: the 'AI unavailable' state is what can be shown"],
  "/api/forecasting": ["S-112", "ui", "same"],
  "/api/audit-logs": ["S-114", "ui"], "/api/import-history": ["S-060", "ui"], "/api/import-history/[id]": ["S-060", "ui"],
  "/api/categories": ["S-050", "ui"], "/api/categories/[id]": ["S-051", "ui"],
  "/api/client-portal": ["S-022,S-113", "ui"], "/api/supplier-portal": ["S-021,S-113", "ui"],
  "/api/dashboard": ["S-010,S-111", "ui"],
  "/api/email/queue/process": ["ND-07", "nd", "QStash-signed webhook"],
  "/api/health": ["S-032", "ui"], "/api/openapi": ["S-031", "ui"], "/api/performance": ["S-032", "ui"], "/api/system-metrics": ["S-032", "ui"],
  "/api/invoices": ["S-094", "ui"], "/api/invoices/[id]": ["S-094,S-095", "ui"], "/api/invoices/[id]/pdf": ["S-094", "ui"],
  "/api/invoices/[id]/send": ["S-094", "ui", "email not configured: the visible result is what is asserted"],
  "/api/invoices/reminders": ["ND-08", "nd", "cron / internal-key endpoint; no screen by design"],
  "/api/notifications": ["ND-09", "nd", "sends email through Brevo; not configured"],
  "/api/notifications/in-app": ["S-028,S-088", "ui"], "/api/notifications/in-app/[id]": ["S-102", "ui"],
  "/api/notifications/in-app/mark-all-read": ["S-102", "ui"], "/api/notifications/in-app/unread-count": ["S-028", "ui"],
  "/api/orders": ["S-084", "ui"], "/api/orders/[id]": ["S-091,S-092,S-093,S-096", "ui"],
  "/api/payments/checkout": ["ND-10", "nd", "Stripe Checkout needs Stripe keys and Stripe's hosted page"],
  "/api/payments/confirm-session": ["ND-10", "nd", "same"],
  "/api/payments/webhook": ["ND-11", "nd", "Stripe-signed webhook"],
  "/api/portal/client": ["S-080", "ui"], "/api/portal/client/browse-meta": ["S-082", "ui"],
  "/api/portal/client/browse-products": ["S-082", "ui"], "/api/portal/client/catalog": ["S-082", "ui"], "/api/portal/supplier": ["S-071", "ui"],
  "/api/product-reviews": ["S-101,S-110", "ui"], "/api/product-reviews/[id]": ["S-110", "ui"],
  "/api/product-reviews/by-product/[productId]": ["S-082", "ui"], "/api/product-reviews/eligibility": ["S-101", "ui"],
  "/api/products": ["S-056,S-058,S-066", "ui"], "/api/products/[id]": ["S-057", "ui"],
  "/api/products/image": ["S-062", "ui", "ImageKit keys absent: visible outcome of the file chooser is what is asserted"],
  "/api/products/qr-code": ["S-057", "ui"], "/api/products-import": ["S-059", "ui"],
  "/api/shipping/labels": ["ND-12", "nd", "Shippo key and network"], "/api/shipping/rates": ["ND-12", "nd", "same"],
  "/api/shipping/tracking": ["ND-12", "nd", "same"], "/api/shipping/webhook": ["ND-13", "nd", "Shippo webhook"],
  "/api/stock-allocations": ["S-063,S-065", "ui"], "/api/stock-allocations/[id]": ["S-065", "ui"], "/api/stock-transfers": ["S-064", "ui"],
  "/api/suppliers": ["S-052", "ui"], "/api/suppliers/[id]": ["S-053", "ui"],
  "/api/support-tickets": ["S-075,S-087,S-097", "ui"], "/api/support-tickets/[id]": ["S-097", "ui"],
  "/api/support-tickets/[id]/replies": ["S-087,S-097", "ui"],
  "/api/support-tickets/owner-products": ["S-075", "ui"],
  "/api/support-tickets/product-owners": ["FND-02", "nosreen", "no client code references it"],
  "/api/system-config": ["S-033", "ui"], "/api/user/email-preferences": ["S-030", "ui"],
  "/api/users": ["S-040,S-045", "ui"], "/api/users/[id]": ["S-046,S-047", "ui"],
  "/api/warehouses": ["S-054", "ui"], "/api/warehouses/[id]": ["S-055", "ui"],
};

const rows = [];
const q = (s) => JSON.stringify(s);
let pi = 0;
for (const p of inv.pages) {
  const m = PAGES[p.url];
  pi++;
  const id = `P-${String(pi).padStart(3, "0")}`;
  if (!m) { rows.push({ id, type: "MODULE", kind: "page", ref: `${p.file} -> ${p.url}`, roles: [], steps: "UNMAPPED", status: "planned", note: "no mapping yet: add one" }); continue; }
  const nd = m[1].startsWith("ND-");
  rows.push({ id, type: "MODULE", kind: "page", ref: `${p.file} -> ${p.url}`, roles: m[0], steps: m[1],
    status: nd ? `not-demonstrable[${m[2]}]` : "planned", note: nd ? "" : (m[2] ?? "") });
}
let ai = 0;
for (const a of inv.api) {
  const m = API[a.url];
  ai++;
  const id = `A-${String(ai).padStart(3, "0")}`;
  const ref = `${a.file} -> ${a.methods.join(",")} ${a.url}`;
  if (!m) { rows.push({ id, type: "MODULE", kind: "api", ref, roles: [], steps: "UNMAPPED", status: "planned", note: "no mapping yet: add one" }); continue; }
  const [steps, kind, note] = m;
  let status = "planned";
  if (kind === "nd") status = `not-demonstrable[${note}]`;
  if (kind === "nosreen") status = "planned";
  rows.push({ id, type: "MODULE", kind: "api", ref, roles: [], steps, status,
    note: kind === "nosreen" ? `CANDIDATE FINDING (api with no screen): ${note}` : (kind === "ui" ? (note ?? "") : "") });
}

// Features from docs/user-flows-and-stories.md (US-xx) plus product features found in code.
const F = [
  ["F-001", "US-01", "Sign in with email and password", [N], "S-009,S-041"],
  ["F-002", "US-02", "Sign in with Google", [N], "ND-06"],
  ["F-003", "US-03", "Keep me signed in checkbox (30 day vs 1 day refresh)", [N], "S-009,S-071"],
  ["F-004", "US-04", "Role-based demo account select on login", [N], "S-004,S-132"],
  ["F-005", "US-05", "Logout confirmation dialog, cancel then confirm", [A, S, C, R], "S-070"],
  ["F-006", "US-06", "Self-registration (creates an admin)", [N], "S-008"],
  ["F-007", "US-07", "Dashboard with store-wide totals", [A], "S-010,S-111"],
  ["F-008", "US-08", "Product create / edit / delete", [A, S], "S-056,S-058,S-066,S-073"],
  ["F-009", "US-09", "CSV import and export of products", [A], "S-059,S-061"],
  ["F-010", "US-10", "Low-stock and stock-out counts", [A], "S-058,S-111"],
  ["F-011", "US-11", "Review and confirm incoming orders", [A], "S-091,S-092"],
  ["F-012", "US-12", "Allocate order stock across warehouses (auto / manual pick)", [A, C], "S-084,S-092"],
  ["F-013", "US-13", "Advance order status through the pipeline", [A], "S-093"],
  ["F-014", "US-14", "Cancel or refund an order", [A], "S-096"],
  ["F-015", "US-15", "Invoices from orders: draft / sent / paid / overdue / cancelled", [A], "S-094,S-095,S-096"],
  ["F-016", "US-16", "Warehouses and stock transfers", [A], "S-054,S-063,S-064,S-065"],
  ["F-017", "US-17", "Sidebar with live count badges", [A], "S-090"],
  ["F-018", "US-18", "Create users and assign roles", [A], "S-041,S-042,S-043,S-044"],
  ["F-019", "US-19", "Delete a user with confirmation (suspend if the UI has it)", [A], "S-047"],
  ["F-020", "US-20", "Admin read view of client and supplier portals", [A], "S-021,S-022,S-113"],
  ["F-021", "US-21", "Support ticket triage, reassign, reply, resolve, close", [A], "S-097"],
  ["F-022", "US-22", "Approve or reject product reviews", [A], "S-110"],
  ["F-023", "US-23", "Activity history (audit trail)", [A], "S-114"],
  ["F-024", "US-24", "Business insights analytics", [A], "S-012,S-112"],
  ["F-025", "US-25", "Personal email notification preferences", [A, S, C], "S-030,S-103"],
  ["F-026", "US-26", "Client: browse catalog with filters", [C], "S-082"],
  ["F-027", "US-27", "Client: place order, blocked when stock is short", [C], "S-083,S-084"],
  ["F-028", "US-28", "Client: track order status", [C], "S-086,S-100"],
  ["F-029", "US-29", "Client: view and pay invoices", [C], "S-100"],
  ["F-030", "US-30", "Client: write a review after delivery", [C], "S-101"],
  ["F-031", "US-31", "Client: raise a support ticket tied to an order", [C], "S-087"],
  ["F-032", "US-32", "Client: notifications on status changes", [C], "S-088,S-102"],
  ["F-033", "US-33", "Supplier: dashboard scoped to own products and orders", [S], "S-071"],
  ["F-034", "US-34", "Supplier: manage only own products", [S], "S-073"],
  ["F-035", "US-35", "Supplier: orders that contain own products", [S], "S-074,S-094"],
  ["F-036", "US-36", "Supplier: view-only invoices", [S], "S-074"],
  ["F-037", "US-37", "Supplier: monthly revenue chart", [S], "S-071,S-116"],
  ["F-038", "US-38", "Supplier: Pro upsell card", [S], "S-071"],
  ["F-039", "US-39", "Confirmation before every destructive action", [A, S, C], "S-047,S-065,S-066,S-070"],
  ["F-040", "US-40", "Dismiss a confirmation dialog by clicking outside", [A], "S-047"],
  ["F-041", "US-41", "Dismiss individual notifications", [C, A], "S-102"],
  ["F-042", "US-42", "Light and dark mode toggle", [A], "S-027"],
  ["F-043", "US-43", "Global page search in the top bar", [A], "S-026"],
  ["F-044", "code", "Product QR code generation and copy", [A], "S-057"],
  ["F-045", "code", "Product image upload (ImageKit)", [A], "S-062"],
  ["F-046", "code", "Soft vs hard product delete by order history (409 / soft / hard)", [A], "S-066,S-116"],
  ["F-047", "code", "Partial payment on an invoice", [A], "S-095"],
  ["F-048", "code", "Invoice PDF download", [A], "S-094"],
  ["F-049", "code", "Support ticket chat replies", [A, S, C], "S-087,S-097,S-102"],
  ["F-050", "code", "Rate limiting on sign-in (429 message)", [N], "S-133"],
  ["F-051", "code", "Back button after sign-out must not reveal private pages", [N], "S-134"],
  ["F-052", "code", "Session survives access-token expiry (silent refresh)", [A], "S-135"],
  ["F-053", "code", "Settings: system config / palette (admin)", [A], "S-033"],
  ["F-054", "code", "Notification bell and per-notification delete", [A, S, C], "S-028,S-102"],
  ["F-055", "code", "Product review eligibility (only after delivery)", [C], "S-101"],
  ["F-056", "code", "Business / Role / Permission models (RBAC) have no screen", [A], "FND-03"],
];
for (const [id, src, name, roles, steps] of F) {
  const nd = steps.startsWith("ND-");
  rows.push({ id, type: "MODULE", kind: "feature", ref: src === "code" ? "found in code" : `docs/user-flows-and-stories.md ${src}`,
    roles, steps, status: nd ? `not-demonstrable[${name}: see ${steps}]` : "planned", note: name });
}

// Negative paths: what a role must NOT see (asserted as absence in the UI).
const NEG = [
  ["N-001", "anonymous: a protected page sends the visitor to /login", [N], "S-001"],
  ["N-002", "supplier nav has only Supplier Portal / My Products / View Orders / Related Invoices; no User Management, Business Insights, Warehouses, Categories, Product Reviews", [S], "S-072"],
  ["N-003", "client nav has only Client Portal / Browse Products / My Orders / My Invoices", [C], "S-081"],
  ["N-004", "retailer: no admin-only controls (user management, create product) even if it lands on the admin shell", [R], "S-120,S-121"],
  ["N-005", "client and supplier lists show no create-user / admin actions", [C, S], "S-073,S-084"],
  ["N-006", "supplier sees only own products and orders containing them", [S], "S-073,S-074"],
  ["N-007", "a second client does not see the first client's orders or invoices", [C], "S-089"],
  ["N-008", "client cannot edit stock or product catalog", [C], "S-082"],
  ["N-009", "supplier cannot reach order fulfilment actions (confirm, ship, cancel)", [S], "S-074"],
  ["N-010", "after sign-out the browser Back button does not show private data", [N], "S-134"],
];
for (const [id, name, roles, steps] of NEG) rows.push({ id, type: "MODULE", kind: "negative", ref: "role boundary", roles, steps, status: "planned", note: name });

// One validation-error state per form, one empty state per list.
const VAL = [
  ["V-001", "login: empty submit, wrong password", "S-002,S-003"], ["V-002", "register: empty, bad email, 5-char password, duplicate email", "S-007,S-136"],
  ["V-003", "forgot password: empty and unknown email", "S-005"], ["V-004", "create user: empty form", "S-040"],
  ["V-005", "category: empty name", "S-050"], ["V-006", "supplier: empty name", "S-052"], ["V-007", "warehouse: empty name", "S-054"],
  ["V-008", "product: missing category, negative price, duplicate SKU", "S-056"], ["V-009", "product import: wrong file type and invalid rows", "S-059"],
  ["V-010", "allocation: more than product quantity", "S-063"], ["V-011", "transfer: more than available", "S-064"],
  ["V-012", "order: no items, quantity above stock", "S-083"], ["V-013", "invoice: order already invoiced", "S-094"],
  ["V-014", "support ticket: empty subject", "S-075"], ["V-015", "review: empty comment", "S-101"],
];
for (const [id, name, steps] of VAL) rows.push({ id, type: "MODULE", kind: "validation", ref: "form", roles: [], steps, status: "planned", note: name });
const EMP = [
  ["E-001", "dashboard with no data", "S-010"], ["E-002", "orders", "S-013"], ["E-003", "invoices", "S-014"], ["E-004", "support tickets", "S-015"],
  ["E-005", "product reviews", "S-016"], ["E-006", "products", "S-017"], ["E-007", "categories", "S-018"], ["E-008", "suppliers", "S-019"],
  ["E-009", "warehouses", "S-020"], ["E-010", "supplier portal (admin view)", "S-021"], ["E-011", "client portal (admin view)", "S-022"],
  ["E-012", "activity history", "S-024"], ["E-013", "notifications", "S-028"], ["E-014", "business insights", "S-012"],
  ["E-015", "supplier portal home (supplier view)", "S-071"], ["E-016", "client portal home", "S-080"],
];
for (const [id, name, steps] of EMP) rows.push({ id, type: "MODULE", kind: "empty-state", ref: "list", roles: [], steps, status: "planned", note: name });

// Not demonstrable, with reasons.
const ND = [
  ["ND-02", "Reset-password form and emailed link", "Brevo is not configured and the sender URL is hard-coded, so no email can be caught. Decision D5."],
  ["ND-04", "The 404 page", "Reachable only by typing a URL, which the human-only rule forbids after the first load."],
  ["ND-05", "Email verification link", "Nothing in the app creates a verification token; the route has no screen."],
  ["ND-06", "Google sign-in", "Needs Google OAuth credentials and Google's own consent screen."],
  ["ND-07", "QStash email-queue webhook", "Signed server-to-server call; no screen."],
  ["ND-08", "Invoice reminder cron endpoint", "Internal-key endpoint with no screen by design."],
  ["ND-09", "Email notifications (Brevo)", "No Brevo key; in-app notifications are demonstrated instead."],
  ["ND-10", "Stripe checkout and payment confirmation", "Needs Stripe keys, the network and Stripe's hosted page. Decision D6."],
  ["ND-11", "Stripe webhook", "Stripe-signed server-to-server call; no screen."],
  ["ND-12", "Shippo rates, labels and tracking", "Needs a Shippo key and the network. Decision D6."],
  ["ND-13", "Shippo webhook", "Server-to-server call; no screen."],
  ["ND-14", "/warehouses and /warehouses/[id] for non-admin roles", "No role has a link to them; reaching them needs URL navigation."],
  ["ND-15", "Waiting-time behaviour: invoice becoming overdue, 30-day refresh expiry, 60-minute reset-token expiry", "Needs days of real time; the clock may not be faked."],
  ["ND-16", "Sentry, PostHog, QStash, Redis outage behaviour", "Operational integrations with no user-visible screen except the status page."],
  ["ND-17", "Direct-URL access control (a client opening an admin URL)", "Forbidden by the human-only rule; covered by the static review and API tests, not by this run."],
];
for (const [id, name, why] of ND) rows.push({ id, type: "MODULE", kind: "not-demonstrable", ref: "external", roles: [], steps: "-", status: `not-demonstrable[${why}]`, note: name });

// Candidate findings recorded as rows so they cannot be forgotten.
rows.push({ id: "FND-01", type: "MODULE", kind: "candidate-finding", ref: "app/api/auth/change-password", roles: [A, S, C, R], steps: "S-030", status: "planned", note: "no change-password screen exists; confirm during the run, then escalate (needs a product decision on where it lives)" });
rows.push({ id: "FND-02", type: "MODULE", kind: "candidate-finding", ref: "app/api/support-tickets/product-owners", roles: [], steps: "S-075", status: "planned", note: "no client code references it: dead route or missing screen" });
rows.push({ id: "FND-03", type: "MODULE", kind: "candidate-finding", ref: "prisma/schema/tenancy.prisma Business/Role/Permission", roles: [A], steps: "S-023", status: "planned", note: "RBAC tables have no screen to create businesses, roles or permissions; confirm and escalate" });

const out = [];
out.push(`# Coverage matrix for the FULL_PRODUCT walkthrough (Phase 0). Machine-readable; the run fails if any row`);
out.push(`# is neither covered nor not-demonstrable with a reason. Final state is copied to out/walkthrough/coverage.yaml.`);
out.push(`meta:`);
out.push(`  project: Octalve IMS`); out.push(`  scope: FULL_PRODUCT`); out.push(`  source_commit: ${commit}`);
out.push(`  status_values: [planned, covered, "not-demonstrable[reason]"]`);
out.push(`  generated_from: [app/**/page.tsx, app/api/**/route.ts, lib/navigation/*, docs/user-flows-and-stories.md]`);
out.push(`rows:`);
for (const r of rows) {
  out.push(`  - id: ${r.id}`);
  out.push(`    type: ${r.type}`);
  out.push(`    kind: ${r.kind}`);
  out.push(`    ref: ${q(r.ref)}`);
  out.push(`    roles: [${r.roles.join(", ")}]`);
  out.push(`    steps: ${q(r.steps)}`);
  out.push(`    status: ${q(r.status)}`);
  if (r.note) out.push(`    note: ${q(r.note)}`);
}
console.log(out.join("\n"));
