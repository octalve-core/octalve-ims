# 0004: Auth hardening ported from Proplity

- **Period / Focus:** 2026-10-26 (a comparison of IMS's auth with Proplity's current auth, then the fixes)
- **Status:** In Progress (code done, tested and gated; PR open, decision (b) built; decisions (c) through (e) and the remaining "still open" items not yet asked)
- **Priority:** High
- **Assignee:** Agent (Claude), for the maintainer
- **Target Branch / PR:** `fix/auth-hardening-from-proplity` (off local `dev`) / [PR #29](https://github.com/octalve-core/octalve-ims/pull/29)
- **Started:** 2026-10-26
- **Ended:** —
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`. The table shows the characters, not a clickable box.

---

## 1. Objective

Bring the IMS auth routes up to the standard Proplity reached after the August port, closing the register rows ISS-0027, 0028, 0029, 0032 and 0033 (and the parts of them that were fixable without a model decision), each with a test that failed on the old code. Decision (a) (`User.status`, closing part of ISS-0102 which this task also opened) and decision (b) (minimum password length, 6 to 8) were approved and implemented in the same branch on 2026-10-26; decisions (c) through (e) and the three remaining "still open" items are to be asked next, one at a time.

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
- [ ] Not done: the Redis limiter for ordinary API routes still fails open and is non-atomic; `verify-email` has no limit

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

---

## 4. Unified Verification & Quality Gates
Run 2026-10-26; re-run after Module E and again after Module F.
- [x] `pnpm typecheck` clean (0 errors; the first run caught three `noUncheckedIndexedAccess` errors in `refresh-route.test.ts`, fixed)
- [x] `eslint` on the touched files: 0 errors, 2 warnings, both already there (`window.location.href` in `hooks/use-auth-refresh.ts`, a tier-boundary import in `lib/auth/unique-username.ts`)
- [x] `pnpm check:manifest` OK
- [x] `vitest` full run, database-writing test excluded: 989 passed, 0 failed, 151 files (after Module F; was 983/150 after Module E; also required adding `VerifyEmailPage.tsx` to `invalidate-coverage.test.ts`'s pre-auth-page allowlist, same as `ResetPasswordPage.tsx`)
- [x] Migration applied cleanly against the local walkthrough database (`octalve_ims_test`) end to end, never against the hosted Neon one
- [ ] `pnpm build` not run (never has been, see HANDOVER)
- [x] Tier exports not re-run: no file moved between tiers; every new file is under `lib/auth` (already `shared`)

---

## 5. Notes, Findings & Deviations
- **Found by comparing IMS with Proplity's current auth** (read-only, 2026-10-26). Proplity's own review findings (docs/auth-review-2026-09-30.md) were fixed there; IMS had the August port without them.
- **ADR 0004 said rate limiting was database-backed (`LoginAttempt`); it was not.** The table existed and nothing wrote to it; all limiting was the Redis presets. This task makes the ADR's sentence true for the auth routes.
- **Decision (a) approved and built 2026-10-26:** `User.status` added, self-registration requires email verification. See Module E. Opened a new gap, logged as ISS-0102: nothing yet lets an admin set SUSPENDED.
- **Decision (b) approved and built 2026-10-26:** minimum password length raised 6 to 8 across register, reset, change-password, admin user-creation, and the verify-email set-password branch. See Module F.
- **Still needs a decision (open-items), not yet asked this session:** a wrong password on login still triggers the refresh interceptor and a hard redirect (ISS-0030, decision d). Register answers 409 "already exists" (ISS-0032, decision c). Confirm exactly one trusted proxy (decision e).
- **Deviation from Proplity:** forgot-password lowercases the email for the limiter key and defers the whole real-user branch to `after()`; Proplity awaits the mail for a real account.
- The ordering rule was followed: the five test files were written and shown failing against the old routes (refresh 7 of 9, login 7 of 9, logout 1 of 5, password routes 9 of 10) before the routes were changed.

## 6. Output & Deliverables
- **Commits:** on `fix/auth-hardening-from-proplity`
- **PR:** [#29](https://github.com/octalve-core/octalve-ims/pull/29), into `dev`
- **Docs:** `docs/issues/README.md`, `docs/tasks/0004-…`, `docs/tasks/current-tasks.md`, `docs/adr/0008-…`, `docs/adr/README.md`, `docs/auth-system-port-plan.md`, `docs/open-items.md`, `docs/HANDOVER.md`
- **Decision (a) additions (2026-10-26):** `prisma/schema/tenancy.prisma`, `prisma/migrations/20261026020000_add_user_status/`, `lib/auth/account-status.ts`, `lib/email/templates.ts` (`generateVerificationEmail`), `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/refresh/route.ts`, `app/api/auth/verify-email/route.ts`, `app/verify-email/page.tsx`, `components/Pages/VerifyEmailPage.tsx`, `components/Pages/RegisterPage.tsx` (copy), `tier-manifest.json`, `lib/react-query/invalidate-coverage.test.ts` (allowlist)
- **Decision (b) additions (2026-10-26):** `lib/validations/auth.ts`, `lib/validations/user-management.ts`, `app/api/auth/change-password/route.ts`, `app/api/auth/verify-email/route.ts`, `lib/api/openapi-spec.ts`, `components/Pages/ApiDocsPage.tsx`, `lib/validations/user-management.test.ts` (new), `lib/validations/auth-api.test.ts`, `lib/auth/password-routes.test.ts`
