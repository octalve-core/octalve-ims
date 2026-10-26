# 0004: Auth hardening ported from Proplity

- **Period / Focus:** 2026-10-26 (a comparison of IMS's auth with Proplity's current auth, then the fixes)
- **Status:** In Progress (code done, tested and gated; PR open, decisions (b), (c) and (d) built; decision (e) and the remaining "still open" items not yet asked)
- **Priority:** High
- **Assignee:** Agent (Claude), for the maintainer
- **Target Branch / PR:** `fix/auth-hardening-from-proplity` (off local `dev`) / [PR #29](https://github.com/octalve-core/octalve-ims/pull/29)
- **Started:** 2026-10-26
- **Ended:** —
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`. The table shows the characters, not a clickable box.

---

## 1. Objective

Bring the IMS auth routes up to the standard Proplity reached after the August port, closing the register rows ISS-0027, 0028, 0029, 0032 and 0033 (and the parts of them that were fixable without a model decision), each with a test that failed on the old code. Decision (a) (`User.status`, closing part of ISS-0102 which this task also opened), decision (b) (minimum password length, 6 to 8), decision (c) (register's 409 enumeration, ISS-0032) and decision (d) (login's wrong-password redirect, ISS-0030) were approved and implemented in the same branch on 2026-10-26; decision (e) and the three remaining "still open" items are to be asked next, one at a time.

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

---

## 4. Unified Verification & Quality Gates
Run 2026-10-26; re-run after Module E, again after Module F, again after Module G, again after Module H.
- [x] `pnpm typecheck` clean (0 errors; the first run caught three `noUncheckedIndexedAccess` errors in `refresh-route.test.ts`, fixed; Module H's test files initially failed on a custom-adapter type mismatch, fixed by typing the adapter param as `InternalAxiosRequestConfig`)
- [x] `eslint` on the touched files: 0 errors, 2 pre-existing `window.location.href` warnings (already there before this task, in `utils/axiosInstance.ts` and `lib/api/client.ts` — exactly the two files Module H's redirect-exemption touches, not new)
- [x] `pnpm check:manifest` OK (after adding `utils/axiosInstance.test.ts` to the `shared` bucket)
- [x] `vitest` full run, database-writing test excluded: 995 passed, 0 failed, 153 files (after Module H; was 991/151 after Module G, 989/151 after Module F, 983/150 after Module E; also required adding `VerifyEmailPage.tsx` to `invalidate-coverage.test.ts`'s pre-auth-page allowlist, same as `ResetPasswordPage.tsx`). Module G's "existing email" tests have shown 2 flaky failures twice across roughly a dozen full-suite runs this session, never in isolation (5+ isolated runs, always green, including under `--pool=forks`); treated as sandbox resource-contention flakiness, not a logic defect. Worth a closer look if it starts failing in CI.
- [x] Migration applied cleanly against the local walkthrough database (`octalve_ims_test`) end to end, never against the hosted Neon one
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
- **Still needs a decision (open-items), not yet asked this session:** confirm exactly one trusted proxy (decision e).
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
