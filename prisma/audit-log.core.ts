/**
 * Audit Log Prisma helpers — Core tier variant.
 *
 * createAuditLog is called fire-and-forget from every core CRUD route
 * (categories/invoices/orders/products/suppliers/users/warehouses) for audit
 * trail — that's core-tier value, not a Pro upsell. getAuditLogs (the
 * browse/filter query) backs the Pro-gated admin audit-log viewing route
 * (app/api/audit-logs, excluded from a Core export) and is dropped here.
 */

import { prisma } from "@/prisma/client";
import type { CreateAuditLogInput } from "@/types";

const MAX_AUDIT_LOGS = 50;

/**
 * Create an audit log entry. Enforces FIFO: if total count > MAX_AUDIT_LOGS, deletes oldest.
 */
export async function createAuditLog(data: CreateAuditLogInput) {
  const created = await prisma.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      details: data.details as object | undefined,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      createdAt: new Date(),
    },
  });

  const total = await prisma.auditLog.count();
  if (total > MAX_AUDIT_LOGS) {
    const toDelete = total - MAX_AUDIT_LOGS;
    const oldest = await prisma.auditLog.findMany({
      orderBy: { createdAt: "asc" },
      take: toDelete,
      select: { id: true },
    });
    if (oldest.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { id: { in: oldest.map((o) => o.id) } },
      });
    }
  }

  return created;
}
