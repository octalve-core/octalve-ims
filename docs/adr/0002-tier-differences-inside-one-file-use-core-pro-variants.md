# 0002 — A file that differs by tier gets `.core` / `.pro` sibling variants, chosen by exact tier

Status: Proposed
Decided by: roji-tech (commit author; acceptance by the maintainer still needed) · Date: 2026-08-27 (Phases 9–11, per `ims_progress.md`)
Recorded: 2026-10-21
Backfilled: commit `2b6d285` ("Tier-export hygiene: Core/Pro/Premium boundary fixes (phases 0-20)")

## Context

Many components and routes mix tiers in one file: for example `OrderDetailActionBar` has Pay (Pro) and Ship (Premium) buttons, and `AdminSettingsContent` is Pro-only content. Moving whole folders between buckets cannot fix those; the file itself has to differ per edition.

## Decision

- A tiered variant sits beside its base file: `Foo.core.tsx`, `Foo.pro.tsx`, and optionally `Foo.premium.tsx`.
- The base file `Foo.tsx` is the complete (Premium) behaviour and is what the full app runs.
- `scripts/export-tier.ts` copies the variant that matches the target tier exactly, under the base file's name.
- **No cross-tier fallback**: a Pro export does not reuse a `.core` variant just because no `.pro` exists (`export-tier.ts:127`). An earlier fallback design silently stripped Pro-entitled features and was removed.
- A variant inherits its base file's bucket and is not listed in the manifest on its own (`check-tier-manifest-coverage.ts` skips variant names).

## Alternatives Considered

- **Cross-tier fallback** (a missing `.pro` falls back to `.core`): rejected, it mis-stripped paid features.
- **Runtime feature flags inside one file**: not recorded as considered; they would ship Pro/Premium code to Core, which 0001 exists to prevent.

## Consequences

- Variants are copies, so they can drift from the base. Nothing checks that a variant exports the same names or props as its base.
- The comment at the top of `tier-manifest.json` still says the export falls back down the tier chain; that is wrong (see `docs/issues/README.md`).
- Tests that scan files dynamically (the invalidation audit) gain extra cases per variant.
- **Revisit if:** variant drift causes a bug, or the variant count (48 at 2026-10-21) makes review impractical.

## Enforced by

`scripts/export-tier.ts` (selection) and `scripts/check-tier-manifest-coverage.ts` (variant skip). Variant API parity is `review only`.

## Binds

- `scripts/export-tier.ts`
- `scripts/check-tier-manifest-coverage.ts`
- every `*.core.ts(x)` and `*.pro.ts(x)` file
- `docs/development-history/phases/phase-9-per-tier-file-variants.md`
