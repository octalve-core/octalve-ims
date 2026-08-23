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
