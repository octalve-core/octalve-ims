# 0004: Auth hardening ported from Proplity

- **Period / Focus:** 2026-10-26 (a comparison of IMS's auth with Proplity's current auth, then the fixes)
- **Status:** In Progress (code done, tested and gated; waiting for review, push and merge)
- **Priority:** High
- **Assignee:** Agent (Claude), for the maintainer
- **Target Branch / PR:** `fix/auth-hardening-from-proplity` (off local `dev`) / no PR yet
- **Started:** 2026-10-26
- **Ended:** —
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`. The table shows the characters, not a clickable box.

---

## 1. Objective

Bring the IMS auth routes up to the standard Proplity reached after the August port, closing the register rows ISS-0027, 0028, 0029, 0032 and 0033 (and the parts of them that were fixable without a model decision), each with a test that failed on the old code.

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

---

## 4. Unified Verification & Quality Gates
Run 2026-10-26.
- [x] `pnpm typecheck` clean (0 errors; the first run caught three `noUncheckedIndexedAccess` errors in `refresh-route.test.ts`, fixed)
- [x] `eslint` on the touched files: 0 errors, 2 warnings, both already there (`window.location.href` in `hooks/use-auth-refresh.ts`, a tier-boundary import in `lib/auth/unique-username.ts`)
- [x] `pnpm check:manifest` OK
- [x] `vitest` full run, database-writing test excluded: 968 passed, 0 failed, 150 files
- [ ] `pnpm build` not run (never has been, see HANDOVER)
- [x] Tier exports not re-run: no file moved between tiers; every new file is under `lib/auth` (already `shared`)

---

## 5. Notes, Findings & Deviations
- **Found by comparing IMS with Proplity's current auth** (read-only, 2026-10-26). Proplity's own review findings (docs/auth-review-2026-09-30.md) were fixed there; IMS had the August port without them.
- **ADR 0004 said rate limiting was database-backed (`LoginAttempt`); it was not.** The table existed and nothing wrote to it; all limiting was the Redis presets. This task makes the ADR's sentence true for the auth routes.
- **Not fixed, needs a decision (open-items):** IMS has no user `status`, so there is nothing to suspend and no email-verified gate on login or refresh (Proplity checks `SUSPENDED` / `PENDING_VERIFICATION`). Minimum password is 6 (Proplity 8). A wrong password on login still triggers the refresh interceptor and a hard redirect (ISS-0030). Register answers 409 "already exists" (ISS-0032).
- **Deviation from Proplity:** forgot-password lowercases the email for the limiter key and defers the whole real-user branch to `after()`; Proplity awaits the mail for a real account.
- The ordering rule was followed: the five test files were written and shown failing against the old routes (refresh 7 of 9, login 7 of 9, logout 1 of 5, password routes 9 of 10) before the routes were changed.

## 6. Output & Deliverables
- **Commits:** on `fix/auth-hardening-from-proplity`
- **PR:** none yet
- **Docs:** `docs/issues/README.md`, `docs/tasks/0004-…`, `docs/tasks/current-tasks.md`, `docs/adr/0008-…`, `docs/adr/README.md`, `docs/auth-system-port-plan.md`, `docs/open-items.md`, `docs/HANDOVER.md`
