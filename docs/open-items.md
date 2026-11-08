# Open items (Octalve IMS) — the one place to look

Updated 2026-10-21 (end of session). When an item is done, tick it here and link the task or PR; when a new one appears, add it here first. Walkthrough decisions are numbered D1 to D10 in [`tests/walkthrough/README.md`](../tests/walkthrough/README.md); their status is repeated in section 3.

## 0. Settled on 2026-10-21 (kept for the record, nothing to do)

- [x] **Walkthrough database (D1).** Local database `octalve_ims_test` on `127.0.0.1:5432`, created from the `.env` entry the owner pointed to. Empty, no migrations applied yet.
- [x] **PR base branch (D2).** `dev`. `origin/dev` was fast-forwarded from `baa1138` to `d7e6720` so `dev` = `main`. [`HANDOVER.md`](HANDOVER.md) section 3 has the exact steps. `origin/prod` left at `baa1138` on purpose.
- [x] **Licence.** Commercial. `LICENSE` replaced, upstream MIT notice kept in `NOTICE`, both ship in exports ([`adr/0007`](adr/0007-commercial-licence-with-upstream-mit-notice-kept.md), ISS-0069). The follow-ups are in section 1.
- [x] **Walkthrough scope.** One walkthrough per package, taken as per tier (Core, Pro, Premium). Plan: [`tests/walkthrough/per-package-plan.md`](../tests/walkthrough/per-package-plan.md).

## 1. Decisions only the maintainer can make

- [ ] **Accept, change or reject ADRs 0001 to 0007.** They were backfilled from commits and code comments (0007 from the owner's instruction on 2026-10-21) and are all `Proposed`; an agent cannot accept them. See [`adr/README.md`](adr/README.md). ADR 0005 (RLS) records that the mechanism is not wired into any route; 0004 records that nothing tests refresh rotation.
- [ ] **Licence follow-ups.** (a) Who is the legal copyright holder? `LICENSE` says "Octalve", which is an assumption taken from the product and the GitHub organisation; replace it with the registered entity. (b) The terms are a short placeholder (all rights reserved, use only under a written commercial agreement): have the real per-tier terms, warranty and liability wording written or reviewed by whoever handles contracts. (c) Confirm which parts derive from Stockly; `NOTICE` covers the derived portions conservatively and must stay with every copy. (d) Check what was already shared with customers under the old MIT file: that copy stays MIT.
- [ ] **Who may register, and as what?** Today every self-registration (and every first Google sign-in) is an admin, and many admin routes are global (ISS-0001, ISS-0002, ISS-0020 to 0024). Options: first-user-only admin, invite-only, or a least-privilege default role plus per-owner scoping of admin routes. Most of the P1 authorization rows depend on this.
- [ ] **Which scan findings to fix first, and in what batches.** Suggested order: ISS-0001/0002 after the model decision; then the unauthenticated endpoints (ISS-0003 to 0007), the money and stock rows (ISS-0008 to 0016), and the data-exposure rows (ISS-0017 to 0024). Each batch is a task with tests that fail first.
- [ ] **What should a retailer see?** The code gives the retailer role the admin shell with view-only grants (ISS-0064). Decide whether it gets its own portal.
- [ ] **Where should change-password live?** The API exists with no screen (ISS-0084).
- [ ] **Core export type errors.** 17 accepted type errors in Core, 1 in Pro (`development-history/ims_progress.md`). If `next build` type-checks, a Core build fails and so does the Core walkthrough. Fix them, or decide to tolerate them in the export's build configuration.

- [x] **User status (suspend, unverified) on login and refresh.** Decided 2026-10-26 (decision a, task 0004): add `User.status` and require email verification for self-registration. Built the same day — `User.status` (migration `20261026020000_add_user_status`), login and refresh both refuse SUSPENDED/PENDING_VERIFICATION, self-registration issues no session until the emailed `/verify-email` link is followed, OAuth and admin-created users start ACTIVE. **Gap this opened (ISS-0102) closed 2026-11-04:** admin User Management's detail page has a Suspend/Reactivate control (`PUT /api/users/[id]`, `status` field), gated against self-suspend and protected demo accounts (new `lib/auth/protected-emails.ts`, now enforced server-side, not just hidden client-side), and suspending immediately revokes the user's sessions (refresh tokens + `tokensRevokedAt`, reusing task 0004 Module K).
- [x] **Minimum password length.** Decided 2026-10-26 (decision b, task 0004): raise 6 to 8. Built the same day — `lib/validations/auth.ts` (register, reset), `lib/validations/user-management.ts` (admin-created users), `app/api/auth/change-password/route.ts`, `app/api/auth/verify-email/route.ts` (invite/activation set-password branch), plus the OpenAPI spec and API-docs page hint text. Demo/seed accounts (`DEMO_PASSWORD` in `lib/auth/demo-seed-users.ts`) are already 8 characters, so no seed data needed changing.
- [x] **Register tells a visitor that an email already has an account (409).** Decided 2026-10-26 (decision c, task 0004): generic response plus an email to the owner of the address. Built the same day — `app/api/auth/register/route.ts` returns the identical 201 body either way (`REGISTER_RESPONSE_BODY`), a dummy `bcrypt.hash` equalizes the timing, and the existing account's owner is emailed a notice (`generateAccountExistsEmail` in `lib/email/templates.ts`) instead of a second account being created.
- [x] **Wrong password on the login form still triggers the refresh interceptor and a hard redirect** (ISS-0030). Decided 2026-10-26 (decision d, task 0004): exempt `/auth/*`. Built the same day in both `utils/axiosInstance.ts` and `lib/api/client.ts` — any request whose URL contains `/auth/` now skips the refresh-then-redirect branch (it used to exempt only `/auth/refresh`), since every `/auth/*` route answers its own 401s directly.

## 2. Facts only the maintainer can check

- [ ] Do `test@admin.com` and the other demo accounts exist in the hosted Neon database? (ISS-0025)
- [ ] Are `INTERNAL_API_KEY`, QStash and Brevo variables set on any deployed environment? (ISS-0003 to 0005)
- [ ] Was `prisma/rls/001_enable_rls.sql` ever applied to Neon, and does the Neon app role have `BYPASSRLS`? (`select rolbypassrls from pg_roles`)
- [ ] GitHub: does the `production` environment exist with required reviewers; is branch protection on (now that `dev` was fast-forwarded by a direct push, check whether `dev` is protected); which Vercel "Production Branch" is set; are `VERCEL_*` secrets repo-level? (ISS-0059, ISS-0060)
- [x] Which `DATABASE_URL` line in `.env` is effective (three lines; the last, local, probably wins). Print only the host name to check. **Confirmed 2026-11-04:** the last line, `127.0.0.1:5432` (`octalve_ims_test`) — `@prisma/client`'s generated runtime auto-loads `.env` on first import and later duplicate keys overwrite earlier ones, so every test run and every `prisma.*` call in this app that doesn't explicitly override `DATABASE_URL` targets the local database, never the two hosted Neon lines above it. Checked by importing `@/prisma/client` in a throwaway test and printing only the resolved host (no credentials) — never the hosted ones.
- [ ] Are the stray `next start` processes on ports 3130, 3132, 3211 and 3297 yours? They were not started by this work.
- [x] Is the app behind exactly one trusted proxy in every deployed environment (Vercel only)? `getClientIp` in `lib/auth/rate-limit-db.ts` takes the LAST `X-Forwarded-For` hop; behind a second proxy it would pick the wrong address and every user behind it would share one login budget (task 0004, ADR 0008). **Confirmed by the maintainer 2026-10-26 (decision e): Vercel only, everywhere, as of today** — but the maintainer isn't certain that stays true (a future CDN/WAF/load balancer in front of Vercel would add a second hop). No code change made; `getClientIp()` keeps trusting the last hop. **Re-check if the deployment topology ever changes** — see ADR 0008's "Revisit if" clause.
- [x] **Redis rate limiter for ordinary API routes fails open and is non-atomic.** Fixed 2026-11-04 (task 0004, Module I): `lib/cache/rate-limit.ts` now runs one Lua script (`eval`, new on `UnifiedRedisClient` in `lib/cache/redis.ts`) instead of separate check-then-record calls, closing the burst-past-the-limit race. Deliberately still fails open on a Redis outage — that tradeoff is unchanged, see ADR 0008.
- [x] **`verify-email` has no rate limit.** Fixed 2026-11-04 (task 0004, Module J): added the database-backed limiter, per address (the route has no email/session to key on) — same pattern as `reset-password`, every attempt counts.
- [x] **Access tokens have no `jti`, so they work until expiry after logout or a password change.** Fixed 2026-11-04 (task 0004, Module K): every access token now carries a `jti`; revocation is enforced via a new `User.tokensRevokedAt` cutoff (checked in `utils/auth.ts`'s `getSessionFromRequest` against the token's `iat`), set by logout, change-password and reset-password alongside their existing refresh-token revocation. Accepted caveat: `iat`'s whole-second resolution means a re-login within the same second as a revocation elsewhere could see one spurious 401 — bounded and narrow, same spirit as ADR 0008's 5-second refresh-replay window.
- [ ] Did CI run green on `dev` after the push to `d7e6720`? (`ci.yml` triggers on pushes to `dev`; it was not checked.)

## 3. Walkthrough (task 0002), paused before Phase 0b and Phase 1

| # | Decision | Status |
|---|---|---|
| D1 | Dedicated database | **Settled**: `octalve_ims_test`, local |
| D2 | PR base branch | **Settled**: `dev` |
| D3 | Redis logical database 15, flushed in preflight (needed for the rate-limit step) | Open; recommended yes |
| D4 | Viewports | **Amended by D10**: desktop pass for each of the three packages first; then the other three viewports (1100, tablet, mobile) per package once the desktop passes are green |
| D5 | Email catcher (needs a `BREVO_API_URL` override in `lib/email/brevo.ts`) | Open; recommended: not demonstrable for now |
| D6 | Stripe, Shippo, ImageKit, AI, Google keys | Open; recommended: not demonstrable, show the "not configured" states |
| D7 | ffmpeg via `ffmpeg-static` outside the repo (none installed) | Open; recommended yes |
| D8 | Playwright 1.56.1 and `@axe-core/playwright` as devDependencies | Open; needs approval before Phase 1 |
| D9 | Product decisions the run will expose (registration = admin, retailer shell, no change-password screen, no screen for businesses/roles/permissions) | Open; become "needs decision" findings |
| D10 | **One walkthrough per package**; "package" = tier; each package is exported, installed, built and run on its own; the database is dropped and recreated before each | **Decided 2026-10-21**; interpretation of "package" to be confirmed in one line |

## 4. Housekeeping that waits on a go-ahead

- [ ] Push the local commits on `dev` (`git push origin dev`) after a look at `git log --oneline origin/dev..dev`.
- [ ] Decide whether and when to promote `main` to `prod` (see `HANDOVER.md` section 3). `origin/prod` is at `baa1138`.
- [x] Repoint the `out/phases/...` citations in `tier-manifest.json` to `docs/development-history/phases/...` (done 2026-11-06, ISS-0083). Still open: delete the originals in `out/` once the copies are checked (`diff -r` showed the 26 phase files identical) — left alone since `out/` is gitignored/local-only and this is a destructive cleanup step, not a docs-drift fix.
- [x] Pointer from `CLAUDE.md` to `docs/HANDOVER.md`, its Stack and schema-change lines corrected, and `AGENTS.md` added (2026-10-21).
- [x] Remaining MongoDB and `npm` statements fixed 2026-11-06 (ISS-0065, ISS-0066): `docs/PROJECT_WALKTHROUGH.md:31`'s diagram and `README.md`'s model list/install commands corrected. `docs/PROJECT_WALKTHROUGH.md:50` and `CLAUDE.md:78`'s "legacy MongoDB rows" notes are legitimate current-behavior explanations, not drift — left as-is. `CLAUDE.md`'s own historical `npm run` entries are covered by its existing top-of-file disclaimer (append-only changelog; trust the code over old entries), not rewritten line-by-line.
- [ ] Fix the time-bomb test `lib/orders/invoice-event-date.test.ts` so CI can go green (ISS-0057); it is a one-file change.
- [ ] Add a check that `NOTICE` and `LICENSE` exist and are in every export (nothing enforces it today; ADR 0007 says "review only").
