/**
 * ISS-0024 — order creation used to trust a non-client caller's
 * `clientId` body field as-is: any string at all, including a real but
 * unrelated user's id, got attached as the order's buyer. That
 * misattributes the order (and its "your order was created" notification)
 * to someone who never placed it. Only a real user with role "client" may
 * be named as the buyer this way.
 */
import { prisma } from "@/prisma/client";

export async function resolveOrderClientId(
  bodyClientId: string | null,
  actingUserId: string,
): Promise<string | null> {
  if (!bodyClientId || bodyClientId === actingUserId) return null;

  const clientUser = await prisma.user.findUnique({
    where: { id: bodyClientId },
    select: { role: true },
  });
  return clientUser?.role === "client" ? bodyClientId : null;
}
