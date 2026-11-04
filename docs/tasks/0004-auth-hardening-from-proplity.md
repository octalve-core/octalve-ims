# 0004: Auth hardening ported from Proplity

- **Period / Focus:** 2026-10-26 (a comparison of IMS's auth with Proplity's current auth, then the fixes)
- **Status:** All of decisions (a)-(e) and all three "still open" items are settled and built (2026-10-26 to 2026-11-04); the admin suspend/reactivate gap decision (a) opened (ISS-0102) is also closed (Module L, 2026-11-04); PR open, pending maintainer review/merge
- **Priority:** High
- **Assignee:** Agent (Claude), for the maintainer
- **Target Branch / PR:** `fix/auth-hardening-from-proplity` (off local `dev`) / [PR #29](https://github.com/octalve-core/octalve-ims/pull/29)
- **Started:** 2026-10-26
- **Ended:** —
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`. The table shows the characters, not a clickable box.

---

## 1. Objective

Bring the IMS auth routes up to the standard Proplity reached after the August port, closing the register rows ISS-0027, 0028, 0029, 0032 and 0033 (and the parts of them that were fixable without a model decision), each with a test that failed on the old code. Decision (a) (`User.status`, closing part of ISS-0102 which this task also opened), decision (b) (minimum password length, 6 to 8), decision (c) (register's 409 enumeration, ISS-0032), decision (d) (login's wrong-password redirect, ISS-0030) and decision (e) (trusted-proxy assumption confirmed, no code change) were all settled on 2026-10-26; the three remaining "still open" items are to be asked next, one at a time.

## 2. Context & Related Docs
- [`../auth-system-port-plan.md`](../auth-system-port-plan.md): what was ported in August; its new "Hardening after the port" section lists what was ported afterwards and why.
- [`../adr/0008-auth-hardening-after-the-port.md`](../adr/0008-auth-hardening-after-the-port.md) (Proposed).
- Proplity references: `docs/auth-review-2026-09-30.md`, `docs/security-audit-2026-10-21.md`, its ADR-0016 (refresh grace window).
- Register rows ISS-0027, 0028, 0029, 0032, 0033; scan detail [`../issues/scan-2026-10-21-auth.md`](../issues/scan-2026-10-21-auth.md) A6 to A9, A13, A14.
- What was compared and found: see section 5.

---

## 3. Work Breakdown

### Module A: Rate limiting (ISS-0027)
- [x] `lib/auth/rate-limit-db.ts`: database-backed sliding window under an advisory lock, `reserveAttempt` / `releaseAttempt` / `getClientIp` (8 tests)
- [x] Login: per address+email (5/5 min) and per account across addresses (30), both handed back on success (before: per email only, successes counted)
- [x] Refresh: 30/5 min per address; a visitor with no refresh cookie spends nothing
- [x] Register, reset-password (per address), forgot-password (per address+email, and 5/hour per email), change-password (per signed-in user)
- [x] `lib/api/rate-limit.ts`: the Redis presets no longer trust a client-sent `x-user-id`; the address key is the last `X-Forwarded-For` hop
- [x] The Redis limiter for ordinary API routes is now atomic (one Lua script via a new `eval()` on `UnifiedRedisClient`, replacing separate ZREMRANGEBYSCORE/ZCARD/ZADD/EXPIRE calls) — see Module I. Still deliberately fails open (unchanged; see ADR 0008's "Alternatives Considered").
- [x] `verify-email` now has a rate limit, per address (see Module J). Access tokens now carry a `jti` and are rejected once revoked, per user, by logout/change-password/reset-password (see Module K).

### Module B: Refresh (ISS-0028, ISS-0029)
- [x] New token inherits the old token's expiry; cookie `maxAge` is the time left (before: always +7 days)
- [x] 5-second grace window with an atomic claim of the successor; a losing retry does not clear cookies or revoke the family
- [x] Rotation is one atomic update that also records `replacedBy`
- [x] `hooks/use-auth-refresh.ts` uses the shared single-flight `refreshAccessToken()`

### Module C: Logout and enumeration (ISS-0033, ISS-0032)
- [x] Logout accepts an expired (but correctly signed) access token to revoke the user's refresh tokens
- [x] Login runs a dummy bcrypt compare for unknown emails and password-less accounts
- [x] Forgot-password: lookup, token and mail run in `after()`; identical response; email not logged
- [x] Register no longer returns database error text
- [x] Reset-password consumes the token atomically (delete-then-act in one transaction)

### Module D: Docs
- [x] Register rows updated; this task; ADR 0008; port plan section; open-items; HANDOVER
- [x] Tests: 56 in `lib/auth/` (47 new across five files)

### Module E: User.status / email verification (decision a, 2026-10-26)
- [x] `User.status` (plain string, matching this schema's convention for `role`: no Prisma enums anywhere else) — ACTIVE / SUSPENDED / PENDING_VERIFICATION (`lib/auth/account-status.ts`), migration `20261026020000_add_user_status`, default ACTIVE so no existing row changes behavior
- [x] Login refuses SUSPENDED and PENDING_VERIFICATION, checked only after the real password is confirmed (same enumeration-avoidance ordering as ISS-0032)
- [x] Refresh refuses both too, and additionally revokes the whole refresh-token family — a session opened while ACTIVE stops working the moment it's suspended, not just at the next login
- [x] Self-registration now creates PENDING_VERIFICATION and issues no session (no refresh token, no cookies); sends a verification email via `after()` (`generateVerificationEmail`, mirrors `generatePasswordResetEmail`)
- [x] `verify-email` route now activates the account (ACTIVE), scoped to exclude SUSPENDED so a stale/live token can never undo a suspension; works on both its existing branches (self-registration confirmation with no password, and the pre-existing set-a-password/invite branch)
- [x] New frontend page `/verify-email` (`components/Pages/VerifyEmailPage.tsx`) consumes the emailed token; `RegisterPage.tsx` copy updated to say "check your email"
- [x] OAuth sign-ups (`oauth/google/callback/route.ts`) and admin-created users (`prisma/user-admin.ts`) take the schema default (ACTIVE) unchanged — neither needed a code change
- [x] 14 tests in `login-route.test.ts` (4), `refresh-route.test.ts` (4) and `password-routes.test.ts` (6: 2 for register, 4 for verify-email), each shown failing against the old routes first
- **Gap opened, out of scope for this decision, logged as ISS-0102:** nothing gives an admin a way to ever set a user's status to SUSPENDED — `updateUserAdminSchema` / `PUT /api/users/[id]` has no `status` field. The enforcement is real but currently unreachable without a follow-up "suspend/reactivate user" admin feature.

### Module F: Minimum password length 6 → 8 (decision b, 2026-10-26)
- [x] `lib/validations/auth.ts`: `registerSchema` and `resetPasswordSchema` both raised 6 → 8, message updated
- [x] `lib/validations/user-management.ts`: `createUserAdminSchema` (admin-created users) raised 6 → 8
- [x] `app/api/auth/change-password/route.ts`: inline length check raised 6 → 8
- [x] `app/api/auth/verify-email/route.ts`: the set-a-password/invite branch's inline check and message raised 6 → 8, for consistency with the schemas above (not itself one of the five named surfaces, but shares the same message and would otherwise be the one place still accepting 6)
- [x] `lib/api/openapi-spec.ts` and `components/Pages/ApiDocsPage.tsx`: doc/spec hint text updated to match
- [x] Demo/seed accounts checked: `DEMO_PASSWORD` (`lib/auth/demo-seed-users.ts`) is already `"12345678"` (8 characters) — no seed data needed changing
- [x] Tests written first and shown failing against the old 6-character minimum, then made to pass: 2 new in `lib/validations/auth-api.test.ts` (register, reset boundary), 2 new in a new file `lib/validations/user-management.test.ts` (admin-create boundary), 1 new in `lib/auth/password-routes.test.ts` (change-password boundary); plus a renamed existing reset-password test to reflect the new boundary

### Module G: Register no longer answers whether an email exists (decision c, ISS-0032, 2026-10-26)
- [x] `app/api/auth/register/route.ts`: the email-exists branch and the real-signup branch now return the exact same `REGISTER_RESPONSE_BODY` (a generic 201 message), replacing the old 409 "already exists"
- [x] The email-exists branch runs `bcrypt.hash(password, 12)` on the submitted password anyway and discards the result, so the branch costs about what the real signup path costs — same reasoning as login's dummy-hash compare, so response time doesn't leak which branch ran
- [x] The email-exists branch creates no second account and no verification token; instead it emails the existing address a notice (`generateAccountExistsEmail`, new, in `lib/email/templates.ts`) with a sign-in link and a forgot-password link, deferred to `after()` like the verification email
- [x] 2 new tests in `lib/auth/password-routes.test.ts`: the two branches' responses are asserted byte-identical, and the notice email is asserted to fire (with no verification token created) for the email-exists branch

### Module H: Login's wrong-password redirect (decision d, ISS-0030, 2026-10-26)
- [x] `utils/axiosInstance.ts` and `lib/api/client.ts`: the response interceptor's exemption, previously only `/auth/refresh`, now covers any `/auth/*` URL (login, register, refresh, ...) — these routes answer their own 401s directly and must never trigger the refresh-then-redirect flow meant for an expired session on a protected route
- [x] A wrong password on login (`POST /api/auth/login` → 401) no longer fires a pointless refresh attempt and hard redirect before the real "Invalid email or password" error reaches the login form
- [x] 4 new tests, 2 per file (new `utils/axiosInstance.test.ts` and new `lib/api/client.test.ts`), each using a custom axios adapter (no real network) to assert: a 401 from an `/auth/*` URL never calls `refreshAccessToken`, while a 401 from an ordinary protected route still does — both shown failing against the old `/auth/refresh`-only exemption first
- [x] `utils/axiosInstance.test.ts` added to `tier-manifest.json`'s `shared` bucket (a loose file directly under `utils/`, which the manifest checker requires individually listed; `lib/api/client.test.ts` needed no entry — `lib/api` is classified as a whole folder)

### Decision (e): trusted-proxy assumption (2026-10-26, confirmed, no code change)
- [x] Asked the maintainer whether the app runs behind exactly one trusted reverse proxy (Vercel) in every environment — `getClientIp()` (`lib/auth/rate-limit-db.ts`) and the CORS/origin checks both trust the last `X-Forwarded-For` hop, which is only correct with exactly one hop in front
- [x] **Answer: yes, Vercel only, as of today — but the maintainer is not certain that stays true.** No code change; this confirms the assumption ADR 0008 already states, it doesn't add new trusted-hop configuration (that would be speculative for a topology that may never exist). Recorded in `open-items.md` section 2, with a note to re-check if the deployment topology changes (a CDN/WAF/load balancer added in front of Vercel)

### Module I: Redis rate limiter made atomic (still-open item, 2026-11-04)
- [x] `lib/cache/redis.ts`: added `eval<T>(script, keys, args)` to `UnifiedRedisClient` and both adapters — Upstash's `client.eval(script, keys, args)`; ioredis's `client.eval(script, keys.length, ...keys, ...args)` (the raw Redis `EVAL` arg order, confirmed against `RedisCommander.d.ts`)
- [x] `lib/cache/rate-limit.ts`: `checkRateLimit` now runs one Lua script (prune expired entries, count, and either reject or record-and-expire) instead of four separate round trips (`ZREMRANGEBYSCORE`, `ZCARD`, then conditionally `ZRANGE`/`ZADD`/`EXPIRE`) — the old version let concurrent requests all read "under the limit" before any of them recorded its own entry, so a burst could race past the configured limit. A single server-side script closes that race; no other command can interleave inside it.
- [x] Deliberately unchanged: still fails open (allows the request) when Redis is absent or the script errors — the maintainer chose "atomic, still fail-open" over "atomic and fail closed," since a Redis outage failing closed would take down every ordinary API route (products, orders, etc.), not just rate limiting. See ADR 0008's existing "Alternatives Considered" entry on this tradeoff.
- [x] Smoke-tested against a real local Redis (not just the mocked unit test): the raw Lua script via `redis-cli --eval` (3 allowed then a correctly-denied 4th, with the right oldest-entry score, `ZCARD` never exceeding the limit), and the exact `ioredis` call signature used in `IORedisAdapter.eval()` via a throwaway Node script — both matched the unit tests' expectations
- [x] 5 new tests in a new `lib/cache/rate-limit.test.ts`: exactly one `eval` call per check (not the old separate calls), correct allow/current, correct deny/reset derived from the oldest entry's score, and both fail-open paths (no Redis; script throws) unchanged — the first three shown failing against the old multi-call implementation first

### Module J: verify-email rate limit (still-open item, 2026-11-04)
- [x] `app/api/auth/verify-email/route.ts`: added the database-backed limiter (`lib/auth/rate-limit-db.ts`), per address, same pattern as `reset-password` — this route has no email or session to key on, only a token, so address is the only identifier available. Every attempt counts, good or bad (the token is a one-shot secret, nothing to hand back on success), placed after the request-shape validation (malformed requests don't spend the budget) and before the token lookup.
- [x] 1 new test in `lib/auth/password-routes.test.ts`'s `verify-email` describe block: a 429 when the reservation is refused, and the token lookup never runs — shown failing against the old unlimited route first
- [x] While verifying this change under the full suite, hardened an unrelated pre-existing flaky assertion in the same file (Module G's "emails the existing address..." test): it asserted an absolute `h.scheduled` length, which occasionally came back one higher than expected under heavy parallel full-suite load (reproduced 3 times across many runs, never once in isolation, including under `--pool=forks`) — rewrote it to assert the *delta* this one request causes and run the *latest* queued callback, which is correct regardless of what else is in the queue and has been clean on every subsequent full-suite run (3 for 3) since. Root cause not fully pinned down (suspected a Vitest/Node scheduling artifact under extreme sandbox CPU contention, not a bug in the route under test), but the test itself no longer depends on it.

### Module K: access-token revocation (still-open item, 2026-11-04)
- [x] `lib/auth/jwt.ts`: every access token now carries a `jti` (`crypto.randomUUID()`, via jose's `.setJti()`) — a per-token identity, for audit/logging and so a future per-token revocation list has something to key on. `signAccessToken`'s parameter type narrowed from the full `AccessTokenPayload` to `{sub, role}` since callers never supplied a jti (it's generated internally); all three callers (login, refresh, OAuth callback) already only pass `{sub, role}`.
- [x] `prisma/schema/tenancy.prisma` / migration `20261104030000_add_tokens_revoked_at`: new nullable `User.tokensRevokedAt`. The actual revocation check uses this per-user cutoff against the token's `iat`, not a per-jti denylist — logout/change-password/reset-password already revoke *every* refresh token for the user ("log out everywhere"), so a per-user cutoff matches that existing blast radius for access tokens too, in one write, rather than a denylist table that would only cover the one token present at the revoking request (which would be weaker than what refresh-token revocation already does).
- [x] `utils/auth.ts`'s `getSessionFromRequest` (the ~150-call-site helper that already fetches the full `User` row) now rejects a token whose `iat * 1000 <= user.tokensRevokedAt`. Costs nothing extra — the User row was already being fetched. The deliberately DB-free `lib/auth/session.ts`'s `getServerSession()` (used by exactly one live call site, `change-password`, plus an unused `with-auth.ts` wrapper) is NOT changed — adding a DB read there would defeat the one thing it exists for.
- [x] `tokensRevokedAt` is now set, alongside the existing refresh-token revocation, by `app/api/auth/logout/route.ts`, `app/api/auth/change-password/route.ts` (merged into the existing password-update call in the same transaction) and `app/api/auth/reset-password/route.ts` (same, inside its existing transaction)
- [x] **Documented, accepted precision caveat:** JWT `iat` only has whole-second resolution, so a token issued in the very same second as a revocation elsewhere can look "before or equal to" the cutoff even if actually signed a moment after — a re-login racing a logout on another device, within the same second, could see one spurious 401 and need one retry. Verified this truncation behavior with a real `jose`-signed token (not just reasoned about it). Accepted as bounded and narrow, same spirit as ADR 0008's existing 5-second refresh-replay window — not worth the added complexity (e.g. a jti allow-list for the race window) to fully close.
- [x] Not changed: `proxy.ts` (the Edge middleware route guard) still only checks JWT signature/expiry, not revocation — it was already not DB-aware (no `status` check either) and is UX routing only, not the real security boundary (that's `getSessionFromRequest`, used by the actual API routes)
- [x] 11 new tests, written first and shown failing against the old behavior: 4 in new `utils/auth.test.ts` (the core revocation check — valid token, revoked-before, revoked-after re-login, no-token/bad-token), 1 each in `lib/auth/logout-route.test.ts`, `lib/auth/password-routes.test.ts`'s `change-password` describe block, and `lib/auth/password-routes.test.ts`'s `reset-password` describe block (each asserting the `tokensRevokedAt` write)
- [x] Migration applied cleanly against the local walkthrough database (`octalve_ims_test`); a separate throwaway script round-tripped a real `tokensRevokedAt` write/read through the actual Postgres column (not just the mocked unit tests) to catch any timestamptz conversion surprise — none found

---

### Module L: admin suspend/reactivate (closes ISS-0102, 2026-11-04)
- [x] New `lib/auth/protected-emails.ts`: centralizes the `PROTECTED_EMAILS` list (the four demo seed accounts) and an `isProtectedEmail()` helper. Previously this list was duplicated in two client components with **no server-side check at all** on `PUT`/`DELETE /api/users/[id]` — a crafted request could already suspend or delete a protected account even though the UI hid the button. This module closes that for `PUT`'s new `status` field; `DELETE` already had its own self-check but still no protected-email check (pre-existing, out of this module's scope — `canDelete` is hardcoded `false` for everyone except the owner in the table view, per an existing product requirement noted in that file).
- [x] `lib/auth/account-status.ts`: new `AdminSettableAccountStatus = Extract<UserAccountStatus, "ACTIVE" | "SUSPENDED">` — the two states an admin may set directly; `PENDING_VERIFICATION` is reachable only by self-registration.
- [x] `lib/validations/user-management.ts`: `updateUserAdminSchema` gains `status: z.enum(["ACTIVE", "SUSPENDED"]).optional()`.
- [x] `types/user-management.ts`: `UserForAdmin` gains `status: UserAccountStatus`; `UpdateUserAdminInput` gains `status?: AdminSettableAccountStatus`.
- [x] `prisma/user-admin.ts`: `USER_SELECT` includes `status`; `updateUserAdmin` — suspending (`status === "SUSPENDED"`) wraps the user update and `prisma.refreshToken.updateMany(...)` in one `$transaction`, and sets `tokensRevokedAt` alongside `status`, reusing Module K's revocation mechanism exactly (same shape as `change-password`/`reset-password`'s transactions) so a freshly-suspended user is signed out immediately instead of only at their next refresh attempt. Reactivating revokes nothing — it's a pure grant-back.
- [x] `app/api/users/[id]/route.ts`'s `PUT`: a `status` change (only a status change — role/name on the same account are unaffected) is refused with 400 for your own account (mirrors `DELETE`'s existing self-check) or a protected account (`isProtectedEmail`), before `updateUserAdmin` is called.
- [x] `lib/server/user-detail-data.ts`, `lib/server/users-data.ts`, `app/api/users/route.ts`: their three independent (pre-existing, not refactored here) `UserForAdmin`-shaping functions all pass through the new `status` field.
- [x] `lib/ui/semantic-badges.tsx`: new `UserAccountStatusBadge` (ACTIVE emerald / SUSPENDED red / PENDING_VERIFICATION amber), same pattern as the existing `UserRoleBadge`.
- [x] `components/admin/AdminUserManagementDetailContent.tsx`: new "Status" card — the status badge, a Suspend button behind an `AlertDialog` confirmation (same pattern as the existing Delete button) when ACTIVE/PENDING_VERIFICATION, a direct Reactivate button when SUSPENDED, and an explanatory note when the control is disabled. Gated by `!isOwner && !isProtectedResolved` — **deliberately not** the existing `canDeleteResolved`'s `isOwner && !isProtectedResolved` pattern one line above it (ISS-0094, a known pre-existing bug left untouched: that condition only ever enables Delete when viewing *your own* account, the opposite of its obvious intent). Also replaced this file's and `UserManagementTableColumns.tsx`'s local, duplicated `PROTECTED_EMAILS` consts with the shared helper.
- [x] 17 new/changed tests, written first and shown failing against the old behavior: `lib/auth/protected-emails.test.ts` (new, 4), `lib/validations/user-management.test.ts` (+3, schema accepts/rejects), `prisma/user-admin.test.ts` (new, 3 — plain update untouched, reactivate revokes nothing, suspend transacts both writes), `app/api/users/[id]/route.test.ts` (new, 5 — ordinary suspend works, self-suspend blocked, protected-suspend blocked, protected account's *name* still editable, admin's own *name* still editable).
- [x] Live-verified in a browser (Playwright against a dedicated `next dev` instance on a free port, database explicitly pinned to local `octalve_ims_test`, demo accounts freshly seeded since the DB was empty): suspend → badge flips to Suspended, Reactivate button appears, PUT returns 200; Reactivate → flips back to Active; a protected account (`test@client.com`) shows the disabled note and a disabled Suspend button; the admin's own account shows the self-blocked note. Also confirmed both guards directly against the API with the admin's real session cookie, bypassing the UI entirely (self-suspend and protected-suspend both 400) — the exact gap this module exists to close. Left all four demo accounts ACTIVE afterward.
- [x] `tier-manifest.json`: added `prisma/user-admin.test.ts` (prisma is a loose-file directory; `app/api` and `lib/auth` are folder-level, so the other two new test files needed no entry).

---

## 4. Unified Verification & Quality Gates
Run 2026-10-26; re-run after Module E, again after Module F, again after Module G, again after Module H, again after Module I, again after Module J, again after Module K, again after Module L (2026-11-04).
- [x] `pnpm typecheck` clean (0 errors; the first run caught three `noUncheckedIndexedAccess` errors in `refresh-route.test.ts`, fixed; Module H's test files initially failed on a custom-adapter type mismatch, fixed by typing the adapter param as `InternalAxiosRequestConfig`; Module L initially missed the `status` field in two other, independent `UserForAdmin`-shaping functions — `app/api/users/route.ts` and `lib/server/users-data.ts`, both pre-existing duplicates of `transformUserForAdmin` — caught by `tsc`, fixed)
- [x] `eslint` on the touched files: 0 errors, 2 pre-existing `window.location.href` warnings (already there before this task, in `utils/axiosInstance.ts` and `lib/api/client.ts` — exactly the two files Module H's redirect-exemption touches, not new); full `eslint .` also run clean after Module L
- [x] `pnpm check:manifest` OK (after adding `utils/axiosInstance.test.ts`, and for Module K, `utils/auth.test.ts`; for Module L, `prisma/user-admin.test.ts` — to the `shared`/`prisma` buckets as applicable)
- [x] `vitest` full run: 1024 passed, 1 pre-existing unrelated failure (`lib/server/tenant-prisma.test.ts`'s RLS test — confirmed identical on the baseline commit before Module L via `git stash`, not caused by this task; a real gap, consistent with ADR 0005's "RLS is not wired into any route"), 159 files (1008/155 after Module K; 1001/154 after Module J; 1000/154 after Module I; 995/153 after Module H; 991/151 after Module G; 989/151 after Module F; 983/150 after Module E; also required adding `VerifyEmailPage.tsx` to `invalidate-coverage.test.ts`'s pre-auth-page allowlist, same as `ResetPasswordPage.tsx`). Module G's "existing email" test flaked 3 times total across many full-suite runs this session (never in isolation); fixed as part of Module J by making the assertion delta-based instead of absolute — see Module J's notes. **While chasing the RLS failure, empirically confirmed** (throwaway test importing `@/prisma/client` and printing only the resolved host) that `.env`'s *last* `DATABASE_URL` line — the local `127.0.0.1:5432` (`octalve_ims_test`) — is always the effective one here, settling the "which line wins" item in `open-items.md` section 2: every test run and every `prisma.*` call in this app targets the local database, never the two hosted Neon lines above it.
- [x] Migration applied cleanly against the local walkthrough database (`octalve_ims_test`) end to end, never against the hosted Neon one; `npx prisma generate` re-run after the schema change (required — `tsc` initially failed on the new field until the client was regenerated)
- [ ] `pnpm build` not run (never has been, see HANDOVER)
- [x] Tier exports not re-run: no file moved between tiers; every new file is under `lib/auth` (already `shared`)

---

## 5. Notes, Findings & Deviations
- **Found by comparing IMS with Proplity's current auth** (read-only, 2026-10-26). Proplity's own review findings (docs/auth-review-2026-09-30.md) were fixed there; IMS had the August port without them.
- **ADR 0004 said rate limiting was database-backed (`LoginAttempt`); it was not.** The table existed and nothing wrote to it; all limiting was the Redis presets. This task makes the ADR's sentence true for the auth routes.
- **Decision (a) approved and built 2026-10-26:** `User.status` added, self-registration requires email verification. See Module E. Opened a new gap, logged as ISS-0102: nothing yet lets an admin set SUSPENDED.
- **Decision (b) approved and built 2026-10-26:** minimum password length raised 6 to 8 across register, reset, change-password, admin user-creation, and the verify-email set-password branch. See Module F.
- **Decision (c) approved and built 2026-10-26:** register no longer answers 409 for an existing email; both branches return the same response and the existing account's owner is emailed instead. See Module G.
- **Decision (d) approved and built 2026-10-26:** the refresh interceptor's `/auth/*` exemption (previously `/auth/refresh` only) stops a wrong login password from triggering a refresh attempt and hard redirect. See Module H.
- **Decision (e) confirmed 2026-10-26:** Vercel only, everywhere, as of today; the maintainer flagged uncertainty about the future, so this needs rechecking if the deployment topology changes. No code change.
- **All five decisions settled 2026-10-26, and all three "still open" items built 2026-11-04**: the Redis rate limiter is atomic (Module I), `verify-email` has a rate limit (Module J), and access tokens carry a `jti` and are rejected once revoked (Module K) — each approved and built the same session it was asked about, unlike (a)-(e) which were all asked and decided together on 2026-10-26. Nothing named in the original brief remains open. ISS-0102 (opened by decision (a)) is now also closed (Module L, 2026-11-04); decision (e)'s "re-check if the topology changes" is the only loose end left.
- **Deviation from Proplity:** forgot-password lowercases the email for the limiter key and defers the whole real-user branch to `after()`; Proplity awaits the mail for a real account.
- The ordering rule was followed: the five test files were written and shown failing against the old routes (refresh 7 of 9, login 7 of 9, logout 1 of 5, password routes 9 of 10) before the routes were changed.

## 6. Output & Deliverables
- **Commits:** on `fix/auth-hardening-from-proplity`
- **PR:** [#29](https://github.com/octalve-core/octalve-ims/pull/29), into `dev`
- **Docs:** `docs/issues/README.md`, `docs/tasks/0004-…`, `docs/tasks/current-tasks.md`, `docs/adr/0008-…`, `docs/adr/README.md`, `docs/auth-system-port-plan.md`, `docs/open-items.md`, `docs/HANDOVER.md`
- **Decision (a) additions (2026-10-26):** `prisma/schema/tenancy.prisma`, `prisma/migrations/20261026020000_add_user_status/`, `lib/auth/account-status.ts`, `lib/email/templates.ts` (`generateVerificationEmail`), `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/refresh/route.ts`, `app/api/auth/verify-email/route.ts`, `app/verify-email/page.tsx`, `components/Pages/VerifyEmailPage.tsx`, `components/Pages/RegisterPage.tsx` (copy), `tier-manifest.json`, `lib/react-query/invalidate-coverage.test.ts` (allowlist)
- **Decision (b) additions (2026-10-26):** `lib/validations/auth.ts`, `lib/validations/user-management.ts`, `app/api/auth/change-password/route.ts`, `app/api/auth/verify-email/route.ts`, `lib/api/openapi-spec.ts`, `components/Pages/ApiDocsPage.tsx`, `lib/validations/user-management.test.ts` (new), `lib/validations/auth-api.test.ts`, `lib/auth/password-routes.test.ts`
- **Decision (c) additions (2026-10-26):** `app/api/auth/register/route.ts`, `lib/email/templates.ts` (`generateAccountExistsEmail`), `lib/auth/password-routes.test.ts`
- **Decision (d) additions (2026-10-26):** `utils/axiosInstance.ts`, `lib/api/client.ts`, `utils/axiosInstance.test.ts` (new), `lib/api/client.test.ts` (new), `tier-manifest.json`
- **Module I additions (2026-11-04):** `lib/cache/redis.ts`, `lib/cache/rate-limit.ts`, `lib/cache/rate-limit.test.ts` (new)
- **Module J additions (2026-11-04):** `app/api/auth/verify-email/route.ts`, `lib/auth/password-routes.test.ts`
- **Module K additions (2026-11-04):** `lib/auth/jwt.ts`, `prisma/schema/tenancy.prisma`, `prisma/migrations/20261104030000_add_tokens_revoked_at/`, `utils/auth.ts`, `utils/auth.test.ts` (new), `app/api/auth/logout/route.ts`, `lib/auth/logout-route.test.ts`, `app/api/auth/change-password/route.ts`, `app/api/auth/reset-password/route.ts`, `lib/auth/password-routes.test.ts`, `tier-manifest.json`
- **Module L additions (2026-11-04, closes ISS-0102):** `lib/auth/protected-emails.ts` (new), `lib/auth/protected-emails.test.ts` (new), `lib/auth/account-status.ts`, `lib/validations/user-management.ts`, `lib/validations/user-management.test.ts`, `types/user-management.ts`, `prisma/user-admin.ts`, `prisma/user-admin.test.ts` (new), `lib/server/user-detail-data.ts`, `lib/server/users-data.ts`, `app/api/users/route.ts`, `app/api/users/[id]/route.ts`, `app/api/users/[id]/route.test.ts` (new), `components/admin/AdminUserManagementDetailContent.tsx`, `components/admin/UserManagementTableColumns.tsx`, `lib/ui/semantic-badges.tsx`, `tier-manifest.json`
