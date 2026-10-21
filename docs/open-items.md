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

## 2. Facts only the maintainer can check

- [ ] Do `test@admin.com` and the other demo accounts exist in the hosted Neon database? (ISS-0025)
- [ ] Are `INTERNAL_API_KEY`, QStash and Brevo variables set on any deployed environment? (ISS-0003 to 0005)
- [ ] Was `prisma/rls/001_enable_rls.sql` ever applied to Neon, and does the Neon app role have `BYPASSRLS`? (`select rolbypassrls from pg_roles`)
- [ ] GitHub: does the `production` environment exist with required reviewers; is branch protection on (now that `dev` was fast-forwarded by a direct push, check whether `dev` is protected); which Vercel "Production Branch" is set; are `VERCEL_*` secrets repo-level? (ISS-0059, ISS-0060)
- [ ] Which `DATABASE_URL` line in `.env` is effective (three lines; the last, local, probably wins). Print only the host name to check.
- [ ] Are the stray `next start` processes on ports 3130, 3132, 3211 and 3297 yours? They were not started by this work.
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
- [ ] Repoint the `out/phases/...` citations in `tier-manifest.json` to `docs/development-history/phases/...`, then delete the originals in `out/` once the copies are checked (`diff -r` showed the 26 phase files identical).
- [ ] Add a short pointer from `CLAUDE.md` to `docs/HANDOVER.md`, and correct the MongoDB statements in `CLAUDE.md` and `docs/PROJECT_WALKTHROUGH.md` (ISS-0065, ISS-0066).
- [ ] Fix the time-bomb test `lib/orders/invoice-event-date.test.ts` so CI can go green (ISS-0057); it is a one-file change.
- [ ] Add a check that `NOTICE` and `LICENSE` exist and are in every export (nothing enforces it today; ADR 0007 says "review only").
