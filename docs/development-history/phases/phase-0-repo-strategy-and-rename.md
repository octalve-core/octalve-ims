# Phase 0 — Repo strategy decision, Stockly → Octalve IMS rename

**Status:** Complete. **Date:** 2026-08 (early session, exact date not logged).

## Why

The product is a commercial inventory-management system sold as three tiered
codebases (Core / Pro / Premium, each a strict superset of the one below),
forked from the Stockly codebase
(`Warehouse-Stock-Inventory-Management-System--NextJS-FullStack-main`). Before
any tier-specific engineering could start, two decisions were required: what
repo-strategy pattern enforces the tier split, and what the product is
actually called.

## What was decided

- **Repo strategy: monorepo + tier-gated export** (the GitLab CE/EE pattern) —
  chosen after a PRD comparing alternatives (separate repos per tier, feature
  flags only, monorepo + export). Rationale: keeps a single source of truth
  for shared code while still producing a genuinely stripped-down Core
  artifact that can't accidentally leak Pro/Premium code to a Core customer.
- **Product identity**: name **octalve-ims**, package manager **pnpm**, ID
  strategy **cuid()**.
- **Target repo path**: `/home/rojitech/Desktop/CODEC/OCTALVE/ims/`.

## What was built

- Full removal of every Stockly reference across the codebase (branding,
  package name, metadata, comments) — verified zero remaining references.
- Established this repo as the working tree for all subsequent phases.

## Next up

Phase 1 — the tier-manifest + export mechanism that actually enforces the
Core/Pro/Premium split decided here.
