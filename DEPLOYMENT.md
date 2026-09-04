# Deployment — Vercel + GitHub Actions

Octalve IMS is a **server-rendered** Next.js 16 app with Prisma against
Postgres (Neon). It cannot be statically exported.

> **A word on "tiers".** This document's branch model uses "tier" for
> *deployment environments* (dev / staging / production) — copied from
> Proplity's CI/CD design. That is unrelated to this repo's own, separate
> `core` / `pro` / `premium` *product* tiers (`tier-manifest.json`,
> `pnpm export:core|pro|premium` — see that file's own history for what
> those are). Every environment below runs the **full** app; the export
> scripts are a packaging step for customer-facing builds, not something
> this pipeline drives. Don't conflate the two "tier" words.

## 0. Branch model

Three environment tiers, each with its own database and its own GitHub
Environment:

| Branch | Role                    | Database                                 | Migrations                                    | App deploy                                   |
| ------ | ----------------------- | ----------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `dev`  | Feature work, PR target | none of its own                          | —                                              | none                                          |
| `main` | Staging                 | staging DB (`staging` Environment)       | **automatic** on push (`migrate-staging.yml`) | Vercel's own git integration (preview-style)  |
| `prod` | Production              | production DB (`production` Environment) | **manual only** (`migrate-production.yml`)    | **manual only** (`deploy-production.yml`)     |

The flow: `dev` → PR into `main` (CI + `migration-check.yml` gate it) →
merges land on `main` and auto-migrate staging → once verified there, PR
`main` → `prod` → after merge, a human runs `migrate-production.yml`,
confirms it succeeded, then runs `deploy-production.yml`. Production is
never touched by an ordinary push — that's the entire point of the split.

**Current state as of this writing**: only one Neon database exists (the
one this repo's `.env` has pointed at all along). It should keep serving as
the `staging` Environment's `DATABASE_URL`/`DIRECT_URL`. A **separate**
production database needs provisioning before `production`'s secrets can be
filled in and `migrate-production.yml`/`deploy-production.yml` are safe to
run for real — until then, treat `prod` as configured-but-not-yet-live.

---

## 1. Provision Postgres (for the new `production` environment)

Any Postgres 18-compatible host works; this repo already uses Neon for
staging, so provisioning a second Neon project for production is the path
of least surprise. Serverless functions open a connection per invocation,
so **production must use a pooled endpoint** or you will exhaust the
connection limit under modest load.

| Provider                   | `DATABASE_URL` (pooled — app)   | `DIRECT_URL` (unpooled — migrations) |
| --------------------------- | -------------------------------- | -------------------------------------- |
| Neon                       | the `-pooler` host               | the plain host                        |
| Supabase                   | transaction pooler, port `6543`  | port `5432`                           |
| PgBouncer / self-hosted    | the bouncer port                 | Postgres' own `5432`                  |
| Plain Postgres (no pooler) | the only URL you have            | leave unset                           |

`DIRECT_URL` exists because `prisma migrate deploy` takes a **session-level
advisory lock** that a transaction-mode pooler silently drops.
`prisma.config.ts` prefers `DIRECT_URL` and falls back to `DATABASE_URL`, so
a single-URL setup needs no extra configuration.

Apply the schema once before the first production deploy:

```bash
DIRECT_URL="<direct url>" pnpm db:migrate:deploy
```

---

## 2. Vercel environment variables

Set these in **Project → Settings → Environment Variables**, scoped to
Production (and Preview, pointing at a _different_ database — this is what
`main`-as-staging and PR previews both build against, per §0).

| Variable               | Required             | Notes                                                                                                                                        |
| ----------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **yes**               | Pooled endpoint.                                                                                                                              |
| `DIRECT_URL`            | if pooled             | Only read by the Prisma CLI, not the app.                                                                                                    |
| `JWT_SECRET`            | **yes**               | Long random string (e.g. `openssl rand -hex 64`). Rotating it logs everyone out.                                                             |
| `NEXT_PUBLIC_API_URL`   | **yes**               | Base URL used for API calls, redirects, and links in outbound email.                                                                         |
| Everything else in `.env.example`'s "OPTIONAL" section | no | App runs fine without them — each just disables the feature it configures (ImageKit, Google OAuth, Brevo email, Redis, Stripe, Shippo, etc). See `.env.example` for the full list and `lib/env.ts` for what each unlocks. |
| `NODE_ENV`              | **no**                | Vercel sets it. Do not add it manually.                                                                                                      |

Unlike some Next.js codebases, `lib/env.ts`'s `validateEnv()` is defined but
**never called** anywhere in this repo — so a missing required var does not
currently fail the build the way a fail-fast guard would. Set them anyway;
routes that read a missing var directly (e.g. `prisma/client.ts` needing
`DATABASE_URL` at runtime) will still fail at request time otherwise.

---

## 3. Vercel project settings

`vercel.json` pins the region and security headers, and now also disables
git-triggered deploys on `prod` (see below). Two manual dashboard steps:

1. **Node version** — set to 22.x (Settings → General).
2. **Set the Production Branch to `prod`** (Settings → Git → Production
   Branch). This is a manual dashboard step — it cannot be set from
   `vercel.json`. Vercel defaults this to your repo's default branch
   (`main`), which is now the staging tier under this repo's branch model
   (§0); leaving it unchanged would make `main` pushes eligible for the
   production domain/env vars.
3. **Production Git deploys are disabled on purpose.** `vercel.json` sets
   `git.deploymentEnabled.prod = false` so that GitHub Actions owns
   production: migrations must be confirmed healthy _before_ the new code
   goes live (`migrate-production.yml`, then `deploy-production.yml` — two
   separate manual steps), and Vercel's own Git integration has no way to
   sequence that or gate it behind a human. `main` and PR branches are
   unaffected — Vercel deploys those automatically as before, just as
   non-production (Preview-scoped) builds.

Add a `regions` field to `vercel.json` if function execution should pin to
a specific Vercel region (keeping functions in the same region as the
database usually matters more than proximity to end users for a
database-heavy app like this one) — omitted here since no region has been
chosen yet.

---

## 4. Background workers / cron

None exist in this codebase today — no `app/api/**/cron/**` routes, no
`vercel.json` `crons` entry. If a scheduled job is added later, gate it the
same way Proplity's `CRON_SECRET` pattern does (a secret compared with
`timingSafeEqual`, sent as `Authorization: Bearer` from Vercel Cron), and
document it here.

---

## 5. GitHub Actions

Six workflows, split by branch tier (§0) rather than one file doing
everything. Repository → Settings → Environments needs two environments —
`staging` and `production` — each with its **own** secrets; they are not
shared, and `production`'s deployment-branch policy should be restricted
server-side to the `prod` branch only (Settings → Environments →
production → Deployment branches), so even a leaked or misconfigured
workflow cannot touch it from anywhere else. `staging` needs no such
restriction; it only ever runs from `migrate-staging.yml`'s own `main`-only
trigger.

**Current state**: the `staging` Environment exists with `DATABASE_URL`
and `DIRECT_URL` set, pointing at the one Neon database this repo has used
all along. `production` does not exist yet — no second database has been
provisioned — so `migrate-production.yml`/`deploy-production.yml` and the
Vercel dashboard settings in §3 are configured-in-code but not yet usable
for real.

### Required secrets, per Environment

| Secret              | `staging` | `production` | Used for                                        |
| -------------------- | --------- | -------------- | -------------------------------------------------- |
| `DATABASE_URL`      | yes       | yes            | migrations (pooled)                              |
| `DIRECT_URL`        | if pooled | if pooled      | migrations (unpooled)                            |
| `VERCEL_TOKEN`      | —         | yes            | Account Settings → Tokens                        |
| `VERCEL_ORG_ID`     | —         | yes            | from `.vercel/project.json` after `vercel link`  |
| `VERCEL_PROJECT_ID` | —         | yes            | same file                                        |

Vercel deploys for `main`/PRs go through Vercel's own git integration (§3),
not GitHub Actions, so `staging` doesn't need the three Vercel secrets —
only `production` does, for `deploy-production.yml`.

### `ci.yml` — on push/PR to `dev`, `main`, or `prod`

```
quality (typecheck, check:manifest, build)
test    (full Vitest suite against an ephemeral postgres:18 container)
```

Two safety gates, no migration or deploy step. Both jobs run on every push
and PR across all three branches.

`quality` also runs `pnpm check:manifest` — this repo's own tier-manifest
coverage check (unrelated to the environment tiers this document is
about; see the callout at the top). It guards the exact bug class this
repo hit repeatedly this year: a file left unclassified, or wrongly
classified, in `tier-manifest.json`, invisible to `tsc` until someone
actually runs `pnpm export:core` and typechecks *that* export. This CI
check does not replace that manual export+typecheck verification — it
only catches the "every file classified exactly once" half of the
problem, not "classified in the *right* bucket."

`test` spins up a throwaway `postgres:18` service container, runs
`prisma migrate deploy` against it, applies `prisma/rls/*.sql` (see below),
then `pnpm script:seed-full-demo` (`prisma/seed.ts`) to populate every
table from scratch, then `pnpm test`. This is a deliberate departure from
a simpler "just run migrations and test" setup: **20+ of this repo's test
files run real Prisma queries and expect specific rows to already
exist** — they were written against this repo's persistent shared dev
database, not a bare freshly-migrated schema. `seed-full-demo` is the one
seed path that's actually self-contained (wipes then recreates every
table), so it's the only one safe to point at a brand-new ephemeral
database.

**Verified against a real run, not just written**: this job's first
real execution (this PR, before the RLS step below was added) hit 827/829
passing on a completely fresh, from-scratch ephemeral database — the
ephemeral-DB + seed design holds up. Two failures surfaced, both now
understood:

- `lib/orders/invoice-event-date.test.ts` — a pre-existing, known-flaky
  date-fixture test, unrelated to this environment (documented elsewhere
  in this repo's own test history before this PR existed).
- `lib/server/tenant-prisma.test.ts` — a **real finding**, not a test bug:
  `prisma/rls/001_enable_rls.sql` (the Postgres row-level-security policy
  for the `Product` table) lives outside `prisma/migrations/` on purpose
  (see `docs/local-dev-setup.md`) and so was never applied by
  `migrate deploy` on the fresh ephemeral database — RLS was simply off,
  so the tenant-isolation assertion correctly failed. Fixed by adding an
  explicit "Apply RLS policies" step (`prisma db execute --file
  prisma/rls/NNN_*.sql`, in filename order) right after migrations, before
  seeding. Safe here because a `postgres:18` service container's default
  role (`postgres`) is a superuser, and Postgres superusers always bypass
  RLS regardless of `FORCE ROW LEVEL SECURITY` — so the later seed step
  (which writes rows with real `businessId`s, unscoped by `forTenant()`)
  is unaffected by enabling RLS first.

**This fix was deliberately NOT ported to `migrate-staging.yml` /
`migrate-production.yml`.** Those run against real, persistent databases —
re-running `CREATE POLICY tenant_isolation ...` on a database that already
has it (staging does, applied by hand per `docs/local-dev-setup.md` at
some point before this pipeline existed) would error on every subsequent
push, since Postgres has no `CREATE POLICY IF NOT EXISTS`. Making that
idempotent and safe to blindly rerun against a real, currently-serving
database is exactly the kind of change that deserves its own verified PR,
not a drive-by edit bundled into this one. **Action item**: when the
`production` database is eventually provisioned, run
`prisma/rls/001_enable_rls.sql` against it by hand once (same command
`docs/local-dev-setup.md` documents for local dev), before trusting
tenant isolation there.

`quality`'s `lint` step (`pnpm lint` / `eslint .`) is **not** part of this
gate — it currently fails with pre-existing errors and ~200 warnings
unrelated to any specific change (see §7). Wire it in once that backlog is
addressed, or scope it to changed files only.

### `migrate-staging.yml` — on push to `main`

Automatic. `prisma migrate deploy` against the `staging` Environment's
database, only when a push actually touches `prisma/schema/**` or
`prisma/migrations/**`. Low risk by design — staging is never the database
real users hit.

### `migration-check.yml` — on PR into `main` or `prod`

Read-only. Runs `prisma validate` plus an informational `prisma migrate
diff` against the `staging` database, so schema drift or conflicts surface
in review instead of at merge time. Skipped for forks (no access to
environment secrets, same reasoning `preview.yml` documents).

### `migrate-production.yml` — manual only

`workflow_dispatch`, requires typing `migrate production` into the confirm
input. Runs `prisma migrate status` before and after `prisma migrate
deploy` against the `production` Environment, so a bad migration is visible
immediately rather than discovered later. Gated to the `prod` branch by the
Environment's own deployment-branch policy — the workflow also checks
`github.ref` itself as a fast, clear failure if that policy is ever
loosened.

### `deploy-production.yml` — manual only, run after the above

`workflow_dispatch`, requires typing `deploy production`. `vercel build`
then `vercel deploy --prebuilt --prod`, so the artifact that ships is
exactly the one built against the schema `migrate-production.yml` just
applied. **Deliberately not chained automatically** to
`migrate-production.yml` — a human confirms the migration actually
succeeded before the code that depends on it goes live. Same `prod`-branch
gate as `migrate-production.yml`.

### `preview.yml` — on PR into `main`

Deploys a preview URL without waiting for tests, so reviewers get a link
fast. Skipped for forks (they have no access to repository secrets).

> **Point Preview at a non-production database.** Set a Preview-scoped
> `DATABASE_URL` in Vercel, or a pull request will read and write live data.

---

## 6. Health check

`GET /api/health` — see `app/api/health/route.ts` for the exact shape
(database, and where configured, ImageKit/Brevo/Redis status). Point an
uptime monitor at this path once production exists.

## 7. Known gaps that matter in production

- **`pnpm lint` currently fails** — 8 errors, ~210 warnings, entirely
  pre-existing and not wired into `ci.yml`'s gate (see §5). Worth
  triaging before turning it into a blocker.
- **RLS policies (`prisma/rls/*.sql`) aren't part of `prisma migrate
  deploy`** on any real database — `ci.yml`'s ephemeral test DB applies
  them explicitly now (see §5), but `migrate-staging.yml` and
  `migrate-production.yml` deliberately do not, since re-running
  `CREATE POLICY` against a database that already has it errors. Run
  `prisma/rls/001_enable_rls.sql` by hand (same command
  `docs/local-dev-setup.md` documents) the first time a *new* database
  (i.e. the eventual production one) is provisioned.
- **`preview.yml` currently fails and is likely redundant** — this repo
  already has Vercel's own git integration active (it deployed
  successfully alongside `preview.yml`'s failure on this pipeline's first
  PR), and `preview.yml` has no repo-level `VERCEL_TOKEN`/`VERCEL_ORG_ID`/
  `VERCEL_PROJECT_ID` secrets set, so it fails outright rather than being
  skipped. Decide: either set those three as repo secrets (not
  environment secrets — `preview.yml` has no `environment:` key) to make
  it work standalone, or delete `preview.yml` and rely on Vercel's native
  integration for PR previews, which appears to already cover this.
- **No `production` Neon database exists yet** — only the single database
  this repo's `.env` has used all along, which now backs `staging`. A
  second, separate database needs provisioning before `production`'s
  secrets can be real and `migrate-production.yml`/`deploy-production.yml`
  attempted for real.
- **`staging`'s GitHub Environment + secrets are done; `production`'s and
  the Vercel dashboard settings are not** — see §5's "Current state". §2,
  §3, and §5's "Required secrets" table are the remaining manual setup
  checklist.
- **Rate limiting** and other cross-cutting concerns are handled
  elsewhere in this codebase (see root `CLAUDE.md` / `docs/` if present) —
  not re-documented here since this file is scoped to deployment plumbing.
