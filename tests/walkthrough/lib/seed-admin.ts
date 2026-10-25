import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { REQUIRED_DB_NAME } from "./preflight";

/**
 * Provisions the walkthrough's one admin account out-of-band, before the
 * recording starts (storyboard.md's "Admin bootstrap" amendment, post
 * ISS-0001): there is no UI path to become admin on a fresh install, so
 * this stage step exists instead of the journey ever clicking through one.
 * This is harness code, not a journey step — it talks to Prisma directly,
 * which no file under tests/walkthrough/steps/ is ever allowed to do.
 */
export const FIRST_ADMIN = {
  name: "Amara Okafor",
  email: "amara.okafor@walkthrough.test",
  password: "Walkthrough#2026",
  role: "admin",
} as const;

const BCRYPT_ROUNDS = 12; // matches app/api/auth/register/route.ts

export async function provisionFirstAdmin(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");
  if (dbName !== REQUIRED_DB_NAME) {
    throw new Error(
      `seed-admin.ts refuses to seed database "${dbName}" — only "${REQUIRED_DB_NAME}" may ever be seeded here.`,
    );
  }

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const hashedPassword = await bcrypt.hash(FIRST_ADMIN.password, BCRYPT_ROUNDS);
    await prisma.user.upsert({
      where: { email: FIRST_ADMIN.email },
      update: {},
      create: {
        name: FIRST_ADMIN.name,
        email: FIRST_ADMIN.email,
        password: hashedPassword,
        role: FIRST_ADMIN.role,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
