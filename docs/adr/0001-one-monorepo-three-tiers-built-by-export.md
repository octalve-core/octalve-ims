# 0001 — One private monorepo; Core, Pro and Premium are built by export

Status: Proposed
Decided by: roji-tech (commit author; acceptance by the maintainer still needed) · Date: 2026-08 (Phase 0; the exact day was not logged)
Recorded: 2026-10-21
Backfilled: commits `cbd048b` (fork baseline), `8fa785a` (tier manifest)

## Context

Octalve IMS is sold as three editions, each a strict superset of the one below (Core ⊂ Pro ⊂ Premium). It was forked from the Stockly codebase. Something has to stop Pro or Premium code reaching a Core customer.

## Decision

- There is one private repository containing every feature.
- `tier-manifest.json` assigns every folder and file to one of four buckets: `shared`, `core`, `pro`, `premium`. `shared` is always included; a tier export includes `shared` plus its own bucket plus every bucket below it.
- `pnpm export:core|pro|premium` (`scripts/export-tier.ts`) copies the matching files into a separate directory. It does not install or build.
- The database schema is not split per tier: every edition's Prisma client contains every model (see 0003).

## Alternatives Considered

- **Separate repositories per tier**, **feature flags only**: both were compared in a PRD (Phase 0 record). The individual reasons for rejecting them were not written down; the record says only that the export model keeps one source of truth while still producing a genuinely stripped Core artifact.

## Consequences

- Where a file lives is a product decision. Every new file must be classified, or `pnpm check:manifest` fails.
- Boundary violations are only warnings today (`import/no-restricted-paths` is set to `warn`), and the Core export still has 17 type errors (all `lib/stock-allocation/*`, accepted debt) at the last progress entry.
- A hook in one bucket can call an API route in a higher bucket and `tsc` will not notice; the export would 404 at runtime (logged in `ims_progress.md`, Phase 20/21).
- **Revisit if:** the first Core customer ships, or the Core/Pro export type-error counts cannot reach zero.

## Enforced by

`pnpm check:manifest` (runs in CI, `ci.yml` quality job). The import-boundary lint is warn-only and `pnpm lint` is not run in CI. `pnpm export:<tier>` followed by `tsc --noEmit` in the output is the real proof, and it is manual: no workflow runs it.

## Binds

- `tier-manifest.json`
- `scripts/export-tier.ts`
- `scripts/check-tier-manifest-coverage.ts`
- `eslint.tier-boundaries.mjs`
- `docs/development-history/ims_progress.md`
