import { prisma } from "@/prisma/client";

/**
 * Tenant-scoped Prisma client for Row-Level Security.
 *
 * Wraps every query in a transaction whose first statement sets a
 * transaction-local (`SET LOCAL`-equivalent) Postgres session variable that
 * the RLS policies read (see prisma/rls/001_enable_rls.sql). The `TRUE`
 * third argument to `set_config` is load-bearing: it scopes the setting to
 * the current transaction only, so a pooled connection can never leak one
 * request's tenant context into another's. Never replace this with a plain
 * `SET` — that would be session-level, not transaction-local, and would be
 * a real cross-tenant data leak under connection pooling.
 *
 * Proven on Product only in Milestone 0 (see prisma/rls/001_enable_rls.sql);
 * roll out to the rest of the tenant-scoped models as each one gets its own
 * RLS policy.
 *
 * Known follow-up, not resolved here: this wraps every call in its own
 * batch transaction, which doesn't compose with an explicit nested
 * `prisma.$transaction(...)` inside the same call site. No such nested
 * calls exist anywhere in the codebase today (confirmed during the Postgres
 * migration), so nothing conflicts yet — reconcile this the day a real
 * atomic multi-model tenant-scoped write is needed (e.g. a stock transfer's
 * decrement+increment).
 */
export function forTenant(businessId: string) {
  return prisma.$extends({
    name: "tenant-scoped-rls",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.tenant_id', ${businessId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}
