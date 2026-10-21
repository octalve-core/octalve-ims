/**
 * Prisma error helpers for API routes.
 */

import { Prisma } from "@prisma/client";

/**
 * Relation / referential delete blocked (e.g. P2014 OrderItem → Product).
 */
export function isPrismaRelationViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2014" || error.code === "P2003") {
      return true;
    }
  }

  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes("Foreign key constraint") ||
      msg.includes("violate the required relation") ||
      msg.includes("referenced record") ||
      msg.includes("delete operation")
    );
  }

  return false;
}

/**
 * Unique constraint violation (P2002). `target` optionally narrows to a
 * specific @unique field (e.g. ProcessedPayment.sessionId), matching
 * Prisma's meta.target array.
 */
export function isPrismaUniqueConstraintViolation(
  error: unknown,
  target?: string,
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  if (!target) return true;
  const meta = error.meta as { target?: string[] | string } | undefined;
  const fields = Array.isArray(meta?.target)
    ? meta.target
    : typeof meta?.target === "string"
      ? [meta.target]
      : [];
  return fields.includes(target);
}
