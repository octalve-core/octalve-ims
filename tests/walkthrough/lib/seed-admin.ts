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

/**
 * Marks a self-registered walkthrough account ACTIVE, out-of-band — the same "no UI path
 * exists for this" reasoning as provisionFirstAdmin above, for a gap task 0004's decision (a)
 * opened after Chapters A/B/C's bootstrap was written: self-registration now creates
 * PENDING_VERIFICATION and issues no session, so the register-then-reload-and-land-on-"/"
 * bootstrap every chapter replays (register Folake, sign out, sign in as the admin) no longer
 * works unmodified — a fresh registrant is bounced back to /login, forever, with no session to
 * reload into. The real UI path is clicking the emailed /verify-email link, which the
 * walkthrough can't demonstrate (D5: no local email catcher) — same class of gap as "no UI
 * path to become admin," so it gets the same answer: a harness-level Prisma write, done before
 * the chapter's own timeline starts, not a journey step. Chapters A/B/C are equally affected
 * if ever re-run; this fix lives here so all of them can use it.
 */
export async function activateSelfRegisteredWalkthroughUser(
  databaseUrl: string,
  email: string,
): Promise<void> {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");
  if (dbName !== REQUIRED_DB_NAME) {
    throw new Error(
      `seed-admin.ts refuses to touch database "${dbName}" — only "${REQUIRED_DB_NAME}" may ever be touched here.`,
    );
  }

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await prisma.user.update({
      where: { email },
      data: { status: "ACTIVE" },
    });
  } finally {
    await prisma.$disconnect();
  }
}
