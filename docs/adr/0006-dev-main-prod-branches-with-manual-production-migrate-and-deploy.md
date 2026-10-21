# 0006 — `dev` is development, `main` is staging, `prod` is production; production is migrated and deployed by hand

Status: Proposed
Decided by: roji-tech (commit author; acceptance by the maintainer still needed) · Date: 2026-09-04
Recorded: 2026-10-21
Backfilled: commit `2592ece` ("adopt Proplity's dev/staging/prod deployment pipeline"), PRs #1 and #2

## Context

The app runs on Vercel with a Neon database. Ordinary pushes must never be able to change production.

## Decision

| Branch | Role | Database | Migrations | App deploy |
|---|---|---|---|---|
| `dev` | feature work, PR target | none | none | none |
| `main` | staging | staging database | automatic on push (`migrate-staging.yml`) | Vercel git integration (preview-style) |
| `prod` | production | production database | manual (`migrate-production.yml`) | manual (`deploy-production.yml`) |

- Flow: `dev` → PR into `main` (CI and `migration-check.yml` gate it) → PR `main` → `prod` → a person runs the production migration, confirms it, then runs the deploy.
- `vercel.json` sets `git.deploymentEnabled.prod = false` so Vercel's Git integration cannot deploy production.
- The word "tier" in `DEPLOYMENT.md` means deployment environment here and is unrelated to the Core/Pro/Premium product tiers in 0001.

## Alternatives Considered

- **Vercel Git integration deploying `prod` automatically**: rejected because it cannot sequence a migration before the code or require a human.

## Consequences

- At the time of writing only one Neon database exists. `DEPLOYMENT.md` says it should serve as staging and that production is "configured-but-not-yet-live". Local `.env` points at a hosted Neon database, so local scripts and tests can reach staging data.
- `main` being staging (not production) differs from the usual meaning of `main`.
- **Update 2026-10-21:** when this was first recorded, `origin/dev` and `origin/prod` were at `baa1138`, five commits behind `main` (`d7e6720`), because the pipeline commits had been merged into `main` directly. `origin/dev` was then fast-forwarded to `d7e6720` (plain push, no force) so `dev` is again the base the documented flow assumes. `origin/prod` was left at `baa1138` on purpose: it is promoted last, by a person (`docs/HANDOVER.md` section 3). Not verified from the repository: whether GitHub branch protection allowed or should have blocked that direct push to `dev`.
- **Revisit if:** a separate production database is provisioned, or a second product shares the pipeline. AlEemaan ADR 0008 and 0013 record the same pattern with `master` as staging.

## Enforced by

`.github/workflows/*.yml`, `vercel.json`, and branch protection in GitHub (not visible from the repository, so unverified).

## Binds

- `DEPLOYMENT.md`
- `.github/workflows/`
- `vercel.json`
