/**
 * REQ-0190 — Support ticket update access + Send-to (assignedToId) mutation policy.
 * Creator/assignee/admin may update ticket fields; only admin may change assignee.
 * REQ-0195 — only admin may change workflow status (non-admin body.status ignored).
 */

import type { SupportTicketStatus } from "@/types";
import { can } from "@/lib/auth/can";

export type TicketAssigneeSession = {
  id: string;
  role: string;
  roleId?: string | null;
};

export type TicketAssigneeRecord = {
  userId: string;
  assignedToId: string | null;
};

/** Who may PUT ticket metadata (subject/priority/etc.). */
export async function canMutateSupportTicket(
  session: TicketAssigneeSession,
  ticket: TicketAssigneeRecord,
): Promise<boolean> {
  if (ticket.userId === session.id) return true;
  if (ticket.assignedToId === session.id) return true;
  return can(session, "SupportTickets", "approve");
}

/**
 * Resolve whether assignedToId from the body should be applied.
 * Non-admin: always undefined (ignored). Admin: pass through (including null).
 */
export async function resolveAssignedToUpdate(
  session: TicketAssigneeSession,
  assignedToId: string | null | undefined,
): Promise<string | null | undefined> {
  if (assignedToId === undefined) return undefined;
  if (!(await can(session, "SupportTickets", "approve"))) return undefined;
  return assignedToId;
}

/**
 * REQ-0195 — workflow status is admin-owned.
 * Non-admin: undefined (ignored even if body includes status).
 * Admin: pass through when provided.
 */
export async function resolveStatusUpdate(
  session: TicketAssigneeSession,
  status: SupportTicketStatus | undefined,
): Promise<SupportTicketStatus | undefined> {
  if (status === undefined) return undefined;
  if (!(await can(session, "SupportTickets", "approve"))) return undefined;
  return status;
}
