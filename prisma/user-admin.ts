/**
 * User Management (admin) Prisma helpers
 * List users, get by id, create, update (role, name), delete. Never expose password.
 */

import { prisma } from "@/prisma/client";
import type { UpdateUserAdminInput, CreateUserAdminInput } from "@/types";
import { ACCOUNT_STATUS } from "@/lib/auth/account-status";
import bcrypt from "bcryptjs";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  username: true,
  role: true,
  image: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getAllUsers(limit = 200) {
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });
}

export async function updateUserAdmin(id: string, data: UpdateUserAdminInput) {
  const payload: {
    role?: string | null;
    name?: string;
    status?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };
  if (data.role !== undefined) payload.role = data.role as string | null;
  if (data.name !== undefined) payload.name = data.name;
  if (data.status !== undefined) payload.status = data.status;

  // Suspending kicks the user out immediately (ISS-0102): revoke every refresh token, the same
  // "log out everywhere" blast radius change-password/reset-password/logout already give, and
  // set tokensRevokedAt so an access token already issued stops working too (Module K, task
  // 0004) instead of surviving its own 15-minute lifetime. Reactivating revokes nothing — it's
  // only granting access back.
  if (data.status === ACCOUNT_STATUS.SUSPENDED) {
    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { ...payload, tokensRevokedAt: new Date() },
        select: USER_SELECT,
      }),
      prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return updated;
  }

  return prisma.user.update({
    where: { id },
    data: payload,
    select: USER_SELECT,
  });
}

/**
 * Create a new user (admin action)
 */
export async function createUserAdmin(data: CreateUserAdminInput) {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      password: hashedPassword,
      username: data.username || null,
      role: (data.role as string) || "user",
      createdAt: new Date(),
    },
    select: USER_SELECT,
  });
}

/**
 * Delete a user by ID (admin action)
 * Note: This is a hard delete. Use cautiously.
 */
export async function deleteUserAdmin(id: string) {
  return prisma.user.delete({
    where: { id },
    select: USER_SELECT,
  });
}

/**
 * Check if email already exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return !!user;
}

/**
 * Check if username already exists
 */
export async function usernameExists(username: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  return !!user;
}
