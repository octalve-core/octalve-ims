import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0102 — suspending a user must also kick them out immediately: revoke every refresh
 * token (same "log out everywhere" blast radius change-password/reset-password/logout already
 * give) and bump tokensRevokedAt (Module K, task 0004) so an already-issued access token stops
 * working too, instead of surviving up to its own 15-minute lifetime after the suspension.
 */

const { userUpdate, refreshTokenUpdateMany, transaction } = vi.hoisted(() => ({
  userUpdate: vi.fn(),
  refreshTokenUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/prisma/client", () => ({
  prisma: {
    user: { update: userUpdate },
    refreshToken: { updateMany: refreshTokenUpdateMany },
    $transaction: transaction,
  },
}));

import { updateUserAdmin } from "./user-admin";

beforeEach(() => {
  vi.clearAllMocks();
  userUpdate.mockResolvedValue({ id: "u1", status: "ACTIVE" });
  refreshTokenUpdateMany.mockResolvedValue({ count: 1 });
  transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
});

describe("updateUserAdmin", () => {
  it("updates role/name without touching tokens when status is not part of the update", async () => {
    await updateUserAdmin("u1", { name: "New Name" });
    expect(transaction).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { updatedAt: expect.any(Date), name: "New Name" },
      select: expect.any(Object),
    });
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });

  it("reactivating a user does not revoke anything — only suspending does", async () => {
    await updateUserAdmin("u1", { status: "ACTIVE" });
    expect(transaction).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { updatedAt: expect.any(Date), status: "ACTIVE" },
      select: expect.any(Object),
    });
  });

  it("suspending a user revokes every refresh token and sets tokensRevokedAt, atomically", async () => {
    await updateUserAdmin("u1", { status: "SUSPENDED" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        updatedAt: expect.any(Date),
        status: "SUSPENDED",
        tokensRevokedAt: expect.any(Date),
      },
      select: expect.any(Object),
    });
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
