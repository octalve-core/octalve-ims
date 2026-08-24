# Auth System Port: Proplity → octalve-ims

Last Updated: 2026-08-23

---

## Why

octalve-ims's current auth (inherited from Stockly) is a single stateless JWT (`{ userId }`) in a `session_id` cookie, checked by DB lookup on every request, with no refresh mechanism, no CSRF defense, no rate limiting, and a free-text `role` field. Proplity's auth system — audited, production-grade, already built — solves exactly these gaps: Edge-compatible short-lived access JWTs (`jose`), opaque DB-backed refresh tokens with atomic rotation and family-wide reuse detection, path-scoped cookies, header-based CSRF, DB-backed rate limiting, and a single-flight client-side refresh interceptor. Decision: port Proplity's **authentication** (identity, sessions, tokens) layer into octalve-ims wholesale. octalve-ims's own **authorization** (Role/Permission/tenancy) design from the Milestone 0 plan is unaffected — the two layers are orthogonal and compose cleanly (see Reconciliation below).

Source: `/home/rojitech/Desktop/CODEC/NextJS/proplity` (read in full this session — schema, every `lib/auth/*` file, every `app/api/v1/auth/*` route, `lib/apiClient.ts`, `context/AuthContext.tsx`, `hooks/useAuthRefresh.ts`, `proxy.ts`, `lib/api/withAuth.ts`).
Target: `/home/rojitech/Desktop/CODEC/OCTALVE/ims` (octalve-ims — Stockly fork, Milestone 0 in progress: tier-manifest done, pnpm switch done, Postgres schema migration not yet done).

## Reconciliation with the already-approved Milestone 0 plan

This **amends** Milestone 0 Steps 3–6 (`/home/rojitech/.claude/plans/clever-moseying-haven.md`), doesn't replace them:

- **Authentication vs. authorization split**: Proplity's `RefreshToken`/`VerificationToken`/`LoginAttempt` tables and `lib/auth/{jwt,cookies,csrf,rateLimit,session}.ts` are pure authentication mechanics — they know nothing about permissions. octalve-ims's own `Role`/`Permission`/`Business` models (M0 Step 4) stay exactly as planned. The JWT payload becomes `{ sub: userId, role: <legacy free-text role string> }` (mirroring Proplity's `{ sub, role }` shape) — this is the same fast-path string our `can()` helper (M0 Step 6) already falls back to when `roleId` is absent; fine-grained Pro+ permission checks still hit the DB via `can()`, unaffected by this port.
- **`VerificationToken` — Step 3 amendment**: M0 Step 3 said delete octalve-ims's `VerificationToken` model outright (it was an unused Mongo-stub in Stockly). That still happens, but it's now **replaced** by Proplity's real, working `VerificationToken` design (Phase 1 below), not left deleted.
- **`register/route.ts` — Step 5 amendment**: M0 Step 5 already planned to rewrite this file to drop raw MongoClient usage. That rewrite is superseded by Phase 3 below — the route gets rewritten once, straight into Proplity's pattern, not twice.
- **ID strategy unchanged**: octalve-ims already committed to `cuid()` (not Proplity's `uuid()`) for all models — token/session tables use `cuid()` too, doesn't affect any token logic (both are opaque strings to the rotation mechanism).
- **New scope not in M0 originally**: CSRF protection, DB-backed rate limiting, refresh-token rotation, and the client-side single-flight interceptor did not exist in the M0 plan at all — this doc is where they enter the project.
- **Google OAuth — open integration point, not in Proplity**: Stockly's existing OAuth callback (`app/api/auth/oauth/google/callback/route.ts`) must be updated to issue the same access+refresh token pair this new system produces (Phase 3), since Proplity has no OAuth flow to draw a pattern from directly — flagged as a design point to resolve during Phase 3, not a mechanical port.
- **`lib/api/withAuth.ts`** (Proplity's route-wrapper: session check + coarse role gate) is worth porting alongside the core files (Phase 2) — it composes with, not replaces, our `can()` helper: `withAuth` for "must be logged in, optionally must have role X" at the top of a route; `can()` inside the handler for tier-aware fine-grained checks.

## Exact file mapping

| Proplity source | octalve-ims destination | Tier bucket |
|---|---|---|
| `prisma/schema/auth.prisma` (RefreshToken, VerificationToken, LoginAttempt models only — User already exists) | `prisma/schema.prisma` (append) | — |
| `lib/auth/jwt.ts` | `lib/auth/jwt.ts` | shared |
| `lib/auth/cookies.ts` | `lib/auth/cookies.ts` | shared |
| `lib/auth/csrf.ts` | `lib/auth/csrf.ts` | shared |
| `lib/auth/rateLimit.ts` | `lib/auth/rateLimit.ts` | shared |
| `lib/auth/session.ts` | `lib/auth/session.ts` (merges with/replaces existing `utils/auth.ts` `getSessionFromRequest`) | shared |
| `lib/api/withAuth.ts` | `lib/auth/with-auth.ts` | shared |
| `app/api/v1/auth/register/route.ts` | `app/api/auth/register/route.ts` (existing file, full rewrite) | shared |
| `app/api/v1/auth/login/route.ts` | `app/api/auth/login/route.ts` (existing file, full rewrite) | shared |
| `app/api/v1/auth/refresh/route.ts` | `app/api/auth/refresh/route.ts` (**new** — doesn't exist in Stockly today) | shared |
| `app/api/v1/auth/logout/route.ts` | `app/api/auth/logout/route.ts` (existing file, rewrite) | shared |
| `app/api/v1/auth/me/route.ts` | `app/api/auth/session/route.ts` (existing file, rewrite — Stockly already calls its equivalent this) | shared |
| `app/api/v1/auth/change-password/route.ts` | `app/api/auth/change-password/route.ts` (check if exists; create/rewrite) | shared |
| `app/api/v1/auth/verify-email/route.ts` | `app/api/auth/verify-email/route.ts` (**new**) | shared |
| `lib/apiClient.ts` | `lib/api/client.ts` (check for an existing equivalent first — Stockly may already have an axios/fetch wrapper under `lib/api/`, reconcile don't duplicate) | shared |
| `context/AuthContext.tsx` | `contexts/auth-context.tsx` (**exists already** — merge Proplity's single-flight-aware fetch pattern into it, don't blindly overwrite Stockly's existing consumers) | shared |
| `hooks/useAuthRefresh.ts` | `hooks/use-auth-refresh.ts` (**new**) | shared |
| `proxy.ts` | `proxy.ts` (existing file, upgrade from cookie-presence check to real `jose` JWT verification) | — (root file, always shipped) |

All destinations already sit in the `shared` bucket of `tier-manifest.json` (confirmed — `lib/auth`, `lib/server`, `lib/api`, `app/api/auth`, `contexts/*` are all already `shared`), so **no manifest changes are needed** for this port.

---

## Phase 1 — Schema

Add to `prisma/schema.prisma` (as part of the Postgres migration in M0 Step 3/4, not a separate migration):

```prisma
model RefreshToken {
  id         String    @id @default(cuid())
  userId     String
  tokenHash  String    @unique
  familyId   String
  revokedAt  DateTime?
  replacedBy String?
  expiresAt  DateTime  @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([familyId])
}

model VerificationToken {
  id        String   @id @default(cuid())
  userId    String   @unique
  tokenHash String   @unique
  expiresAt DateTime @db.Timestamptz(3)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model LoginAttempt {
  id         String   @id @default(cuid())
  identifier String
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdAt  DateTime @default(now()) @db.Timestamptz(3)

  @@index([identifier, createdAt])
}
```

This **replaces** the plan to delete `VerificationToken` outright (M0 Step 3.5) — same model name, real shape instead of an unused Mongo-era stub. Add `refreshTokens RefreshToken[]`, `verificationToken VerificationToken?`, `loginAttempts LoginAttempt[]` back-relations to the existing `User` model. Check whether octalve-ims's `User` model already has a `status` field with `ACTIVE`/`SUSPENDED`/`PENDING_VERIFICATION`-equivalent semantics before adding one — Stockly may already gate on something similar; reconcile rather than duplicate.

## Phase 2 — Core auth library (`lib/auth/`)

Port these five files near-verbatim (only path/id-type adjustments — `cuid()` not `uuid()`, `@/prisma/client` import path if it differs):

1. **`jwt.ts`** — `jose`-based `signAccessToken({ sub, role })` / `verifyToken(token)`, `HS256`, 15-min expiry, same hard-fail-in-production-if-`JWT_SECRET`-unset guard. Note: octalve-ims already has a `JWT_SECRET` env var (confirmed in M0 research) — reuse it, don't add a second secret name.
2. **`cookies.ts`** — `access_token` (path `/`, 15 min) + `refresh_token` (path `/api/auth/refresh` — adjust from Proplity's `/api/v1/auth/refresh` to match octalve-ims's actual route path, no `/v1` prefix exists here) both `httpOnly`, `sameSite: lax`, `secure` in production. octalve-ims currently uses a single `session_id` cookie — this port **replaces** it with the two-cookie scheme; every current reader of `session_id` (grep for it across the codebase first) needs updating in Phase 3/5.
3. **`csrf.ts`** — verbatim Origin/Referer/Host comparison, no changes needed.
4. **`rateLimit.ts`** — verbatim `checkRateLimit`/`recordAttempt`/`getClientIp` against the new `LoginAttempt` table.
5. **`session.ts`** — `getServerSession()` reading `access_token` via `jwt.ts`. octalve-ims already has `getSessionFromRequest`/`getSession` in `utils/auth.ts`/`lib/auth-server.ts` doing a DB-lookup-per-request pattern — **decide during implementation**: keep a DB-lookup variant for routes that need the full `User` row (most of octalve-ims's ~150 inline role checks expect a full session object with more than `{sub, role}`), and add Proplity's lightweight claims-only `getServerSession()` as a second, faster option for routes that only need identity+role. Don't delete the existing full-lookup helper — many call sites depend on fields beyond `id`/`role`.

Also port `lib/api/withAuth.ts` → `lib/auth/with-auth.ts` (route wrapper: session-required + optional role list, calls handler with typed `{ session }`).

## Phase 3 — API routes

Rewrite in this order (each depends on Phase 2 being done first):

1. **`register`**: supersedes M0 Step 5's planned Mongo-cleanup rewrite — do it once, straight to the new pattern. Zod-validate, `bcrypt.hash(password, 12)`, create user, mint `familyId` + opaque refresh token (`crypto.randomBytes(32)`, `sha256` hash stored), 7-day refresh expiry, sign access token, set both cookies. Decide octalve-ims's own default `status`/verification policy here (Proplity defaults to `ACTIVE` immediately — confirm this matches what we want, or require email verification for self-registration, which Proplity itself deferred as a TODO).
2. **`login`**: rate-limit `<ip>:<email>`, verify password, `rememberMe` → 30d or 1d refresh expiry, mint tokens, set cookies.
3. **`refresh`** (new route, doesn't exist today): the atomic `updateMany({ where: { tokenHash, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now } })` rotation guard, `count === 0` → reuse/invalid path (revoke whole `familyId` if the token existed-but-was-already-revoked), `count === 1` → mint successor in the same family via `$transaction`. This is the single most important piece to get byte-for-byte correct — port the exact logic from the research report above, don't approximate it.
4. **`logout`**: read session from `access_token` (refresh cookie isn't visible here, same as Proplity — matches the path-scoping design), revoke all active refresh tokens for that user, clear both cookies.
5. **`me`/session**: reconcile with octalve-ims's existing `GET /api/auth/session` route — same shape (`getServerSession()` → look up user → `401` if missing/inactive).
6. **`change-password`**: verify current password, hash new one, `$transaction` update + revoke all refresh tokens, clear cookies.
7. **`verify-email`** (new route): CSRF-exempt (deliberately, matching Proplity), token hash lookup, activate + optional password set, delete token (single-use).
8. **Google OAuth callback** (`app/api/auth/oauth/google/callback/route.ts`, existing): update to mint the same token pair (familyId + refresh token + access token) as register/login instead of whatever single-cookie scheme it uses today — this is new work, not a Proplity port, since Proplity has no OAuth flow.

## Phase 4 — Client-side wiring

1. **`lib/api/client.ts`**: single-flight `refreshPromise` dedup pattern (module-scoped, both an axios interceptor variant and a plain-`fetch` `apiFetch()` variant) — check what HTTP client octalve-ims's existing `lib/api/` already uses before deciding whether to port Proplity's axios-based version or adapt the pattern to whatever's already there (avoid running two HTTP client libraries side by side).
2. **`contexts/auth-context.tsx`** (existing): merge in the `fetchUser()`-with-401-triggers-one-refresh-retry pattern for initial session hydration, and the single-flight-aware `login`/`register`/`logout` methods — this is a merge into existing consumers, not a wholesale file replacement; audit every current import of this context first.
3. **`hooks/use-auth-refresh.ts`** (new): the 13-minute proactive silent-refresh timer with the `/refresh` → (on failure) `/me` double-check before redirecting, multi-tab safe.

## Phase 5 — `proxy.ts`

Upgrade from the current lightweight cookie-existence check to real `jose` verification (`verifyToken` from Phase 2's `jwt.ts`) plus role-gating on `/admin/*` paths, matching Proplity's pattern:
```ts
const token = req.cookies.get('access_token')?.value;
const payload = token ? await verifyToken(token) : null;
if (!payload) { /* redirect to /login */ }
if (pathname.startsWith('/admin') && !isAdminRole(payload.role)) { /* redirect */ }
```
octalve-ims's protected-route matcher needs its own path list (not Proplity's `/dashboard`/`/admin` — use octalve-ims's actual route tree: `/admin/*` plus whatever else requires auth per `tier-manifest.json`'s `core`/`pro`/`premium` app routes).

## Phase 6 — Dependencies

Add: `jose` (^6.x). Confirm already present: `bcryptjs` (Stockly already uses `bcryptjs` per M0 research), `zod` (already a Stockly dependency). No new DB/cache dependency needed — rate limiting and refresh tokens are pure Postgres, consistent with the M0 Postgres migration already in flight. Remove: nothing new (the `mongodb` package removal is still M0 Step 5's job, unrelated to this port).

## Verification

1. Register a new user → confirm two cookies set (`access_token` path `/`, `refresh_token` path `/api/auth/refresh`), decode the JWT manually to confirm `{sub, role}` shape and 15-min expiry.
2. Manually POST `/api/auth/refresh` twice with the same (now-rotated-away) cookie value → second call must `401` and the *legitimately rotated* token from the first call must also now be dead (family-wide revocation) — this is the one behavior most worth writing an explicit test for, mirroring Proplity's own `phase-10-2-auth-tests.md` approach.
3. Concurrent-request test: fire 3+ simultaneous API calls with an expired access token, confirm exactly one `/refresh` network call happens (single-flight dedup), not three.
4. CSRF: send a mutating auth request with a mismatched `Origin` header → expect `403`, except `verify-email` which must succeed despite the mismatch.
5. Rate limit: 6 rapid failed logins for the same `<ip>:<email>` → 6th attempt blocked.
6. Confirm the existing ~150 inline `session.role === "..."` call sites across octalve-ims still work post-port — the JWT/session shape (`{sub, role}` → hydrated session object) needs to stay backward-compatible with what those call sites expect, or this becomes a much bigger rewrite than intended. Grep for every current consumer of `session_id` cookie name before deleting it, to make sure nothing is missed.
