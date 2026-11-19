# Scan 2026-10-21 — API authorization, ownership and validation

Method: static read of every `app/api/**/route.ts` except auth, payments and shipping, plus `lib/api/response-helpers.ts`, `lib/server/catalog-entity-access.ts` and the `lib/server/*-data.ts` loaders the routes rely on. Nothing was run. Findings come from a delegated reviewer (model output); **re-verified** means re-read by the main session on 2026-10-21. Register rows: `README.md`.

**Root cause behind most items.** Open self-registration assigns `role: "admin"` (`app/api/auth/register/route.ts:82`, see auth A1). Many "admin" branches are global, not per-tenant (`getOrderByIdForAdmin(id)`, `findUnique({id})`, `isAdmin ? {id} : {id,userId}`); other admin endpoints are per-owner (`userId`-scoped products, warehouses, reviews). So any internet user is a cross-tenant admin on the global paths. `businessId` is unused outside `tenant-prisma.ts`; `can()` is not used for tenant scoping; `withAuth()` is used by no route.

## Critical

1. **Any signup can list, re-role and delete every user** (`users/route.ts:53`, `users/[id]/route.ts:112, 169`). Same item as auth A1.
2. **Unauthenticated mail relay** (`POST /api/notifications`, re-verified) and `/api/email/queue/process` skipping signature checks when QStash is unset. Same as auth A2/A4.
3. **Cross-tenant order takeover with a Stripe refund.** `orders/[id]/route.ts:122, 437` use `getOrderByIdForAdmin`, then `updateOrder`/`cancelOrder(id, existingOrder.userId)` (`:168, :450`). Any admin can PUT `status`/`paymentStatus: "paid"` or DELETE any order; cancelling a paid order calls `createStripeRefund` (`prisma/order.ts:845`) and cancels the invoice. GET returns any order to any admin. Fix: scope by `order.userId === session.id` or by product ownership.
4. **Any client can read any order and invoice.** `getOrderByIdForClient` falls back to any order with items (`prisma/order.ts:509-520`); `getInvoiceByIdForClient` likewise (`prisma/invoice.ts:446-462`); `/pdf` authorizes through the same path. Ids leak through `recentOrders`/`invoiceForOrder.id` on product, category and supplier detail. Chain: `GET /api/products/:id` as a client, then `GET /api/orders/:orderId` returns other buyers' addresses, notes, email, tracking. Fix: remove the fallback; redact `recentOrders` for clients.
5. **`INTERNAL_API_KEY` empty-key bypass** (`invoices/reminders/route.ts:34-38`, re-verified). Global effect across tenants; also not constant-time.

## High

6. **Product detail cache is read before any auth check** (`lib/server/product-detail-data.ts:261`, key `products:detail:<id>`; category and supplier detail the same, `cache-utils.ts:241,255,270`). Clients and admins query by `{id}` only. Payload includes `recentOrders[].placedBy` (name, email), amounts, creator and owner emails. Fix: scope keys by role and user, or run the access check first and cache per scope.
7. **Invoice list filters override the scope.** `applyInvoiceFiltersToWhere` sets `where.clientId` and `where.orderId` after the base scope (`prisma/invoice.ts:32,36`): `GET /api/invoices?clientId=<victim>` as a client; `?orderId=<any>` as supplier/owner or on `/api/admin/client-invoices`. Fix: AND the filters into the scope.
8. **Cross-tenant invoice creation and mutation.** `POST /api/invoices` (`:234`) blocks only supplier and client; `createInvoice` loads the order by id with no ownership check (`prisma/invoice.ts:96-125`), sets `userId = order.userId`, accepts attacker `discount`/`tax`/`shipping`/`paymentLink`. PUT/DELETE/send are global for any admin. Plants an invoice with an attacker payment URL; blocks the real invoice; acts as an order-id oracle.
9. **Order creation.** `prisma/order.ts:177-178`: `total = subtotal + tax + shipping - discount` from the body, uncapped (`discount: 1e9` gives zero or negative). `orders/route.ts:267-273`: any non-client role (supplier, retailer) can order any tenant's products (reserving the victim's stock); arbitrary `clientId` attaches the order and a notification to a stranger.
10. **Audit logs.** `audit-logs/route.ts:94-109` returns all admins' logs (userId, IP, user agent, details); `prisma/audit-log.ts:8,28` keeps a global FIFO of 50 rows, so 50 trivial writes erase everyone's trail.
11. **Stock allocations and transfers across tenants.** `findAccessibleProduct` lets admin and client read any product (`lib/products/stock-product-access.ts:42-50`); `GET /api/stock-allocations?productId=` returns other tenants' warehouse names, addresses, quantities; on POST an admin can allocate a victim's product into their own warehouse.
12. **Support tickets.** `canMutateSupportTicket` falls back to `can(...,"SupportTickets","approve")`, true for every admin (`lib/support-tickets/ticket-assignee-policy.ts:22-27`): any admin reads, replies, updates, deletes any ticket. Create does not validate `assignedToId`/`orderId`/`supplierId`, so a creator reads another order's number and statuses via `loadTicketRelatedSnap`. A non-admin ticket with no assignee notifies every admin. `GET /api/support-tickets/product-owners` gives every user all store owners' emails.
13. **Product reviews.** `by-product/[id]` has no auth (`?status=all|pending` returns unmoderated reviews with `reviewerEmail`, `userId`, `route.ts:54-70`); non-admin `GET /api/product-reviews` returns the latest 100 from all tenants; `GET /api/product-reviews/:id` for non-admins has no ownership check (`lib/server/product-review-detail-data.ts:25-32`, inverted: only restricts when `role === "admin"`); any admin can PUT/DELETE any review; POST with no `orderId` skips the purchase check (`route.ts:104`).
14. **`DELETE /api/products/image?fileId=`** (`:132`) deletes any ImageKit file for any logged-in user; `imageFileId`/`qrCodeFileId` are returned by list and detail responses.
15. **Unauthenticated `/api/performance`, `/api/system-metrics`, `/api/health`.** The UI hides the first two by role (`ApiStatusPage.tsx:174`), the APIs are open: heap, CPU, node version, platform, endpoint timings, cache and DB stats. Health makes live calls to ImageKit and Brevo with the private keys on every hit (`health/route.ts:100-200`) and returns DB and Redis `error.message`: recon plus quota-burn amplifier.

## Medium

16. **Foreign keys.** `POST`/`PUT /api/products` accept any `categoryId`/`supplierId` (`products/route.ts:222-266, 404-420`) and echo the foreign names; `Product.sku` is globally unique, so "SKU must be unique" is a cross-tenant SKU oracle.
17. **Rate limiting is weak.** `lib/api/rate-limit.ts:41,53` trusts a client-sent `x-user-id`; `lib/cache/rate-limit.ts:58-67` fails open without Redis; no limit on categories, suppliers, warehouses, products writes, `qr-code`, `ai/insights`, `email-preferences`, `notifications`.
18. **AI cost abuse.** `ai/insights/route.ts` is open to any role, unthrottled, `summary` unbounded (`lib/validations/ai.ts`); warehouse names and quantities go to OpenRouter and Groq; `forecasting` calls the LLM on every per-user cache miss.
19. **Pro RBAC cannot take effect.** Routes pass `{id, role}` (`SessionForDetail`) to `can()`, dropping `roleId`, so the Permission-table path is never reached from routes; categories, suppliers and warehouses mutations have no role gate (a client or supplier can create them).
20. **Raw `error.message` in 5xx bodies** (orders, invoices, stock-allocations, qr-code, system-config, notifications, performance, system-metrics, products/image, products-import): Prisma and Stripe text; business errors such as "Insufficient stock" come back as 500; non-admin product owners get a 500 on order PUT/DELETE because `updateOrder` rescopes by `userId`.
21. **Import and export.** `products-import`: 10 MB cap, no row cap, sequential per-row DB calls, xlsx zip bomb plausible (ExcelJS inflates in memory); bug at `products-import/route.ts:338`: `checkAndSendStockAlerts(p, undefined, undefined, userId)` passes `userId` as `recipientName`, skips preference checks and loops over all of the owner's products, so every import mails alerts for every low-stock product; CSV exports have no formula escaping (`Papa.unparse` without `escapeFormulae`, `lib/export/excel.ts:140`); `products/image` POST trusts the client MIME type and buffers the whole body before the size check.
22. **Caches keyed without role** (category and supplier detail keys unscoped for admin, client, retailer). Plausible; confirm at runtime.

## Low

23. `limit`/`page` unvalidated (NaN gives 500; `limit` unbounded in `notifications/in-app`). 24. A review author can edit the comment after approval without resetting `status`. 25. `users/[id]` PUT lets an admin demote themselves or the last admin.

## Routes with NO ownership scoping or global-admin scope

`users`, `users/[id]`; `system-config`; `audit-logs` (non-period); `client-portal`; `invoices/reminders`; `notifications` (POST, GET); `email/queue/process`; `health`; `performance`; `system-metrics`; `openapi` (public by design); `product-reviews` (list and `[id]` for non-admin, `by-product`, PUT/DELETE for admin); `products/[id]`; `categories/[id]` and `suppliers/[id]` (admin, client); `warehouses/[id]` (admin); `orders/[id]`; `invoices` (POST) and `invoices/[id]` (all verbs, send, pdf); `stock-allocations` (GET productId, POST); `stock-transfers`; `orders` (POST product ownership, `clientId`); `products` (POST/PUT FKs); `support-tickets` (create fields, `[id]`, replies for admin); `support-tickets/product-owners` and `owner-products`; `products/image` (DELETE).

## Routes with NO or weak validation

`health`, `performance` (`endpoint`/`method`), `system-metrics`, `notifications` GET, `audit-logs` (manual `parseInt`), the DELETE-by-query-id routes (categories, suppliers, warehouses, products), `products/image` (`sku`, `fileId`, file content), `invoices/reminders` (`dueSoonDays` unchecked; a string breaks the date), invoice and `admin/client-invoices` list filters, `notifications/in-app` list, `import-history` `limit`, `product-reviews/by-product` `status`, `support-tickets` `view`/`ownerId`, `portal/client/browse-products` ids, `email/queue/process` (JSON cast), `ai/insights` (no max), `products-import` file content.

Routes using Zod and correctly owner-scoped (no finding): categories, suppliers and warehouses mutations, `notifications/in-app*`, `import-history`, `dashboard`, products list and mutations by `userId`, `products/qr-code`, `email-preferences`, `stock-allocations/[id]`.

## Not covered

`prisma/rls` policies; ImageKit and Brevo wrapper internals; `lib/pdf`; full enumeration of order and invoice list helpers (`orders-data.ts`, `enrich-*`); whether production sets `INTERNAL_API_KEY` or QStash vars; runtime confirmation of the cache-bleed and zip-bomb items; Next.js route-handler body-size defaults.
