/**
 * Single source of truth for the one database/Redis-db this repo's tests
 * are ever allowed to touch — shared by `lib/server/tenant-prisma.test.ts`
 * (a real app test, shipped in every tier export) and the walkthrough's
 * `tests/walkthrough/lib/preflight.ts`/`stage.ts` (internal dev tooling,
 * never shipped in any tier export). An app test depending on
 * `tests/walkthrough/` would break every tier export's typecheck, since
 * that directory is deliberately excluded from all of them — this file is
 * the fix: both sides import from here instead.
 */
export const REQUIRED_DB_NAME = "octalve_ims_test";
export const REQUIRED_REDIS_DB_INDEX = 15;
