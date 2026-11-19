import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import { resolveOrderClientId } from "./resolve-order-client-id";

/**
 * ISS-0024 — order creation used to trust clientId straight from the
 * request body: any string, including a real but unrelated user's id,
 * got attached as the order's buyer. Proves only a real "client"-role
 * user can be named this way.
 */
describe.skipIf(!process.env.DATABASE_URL)("resolveOrderClientId (ISS-0024)", () => {
  const stamp = Date.now();
  const createdUserIds: string[] = [];

  async function createUser(role: string, suffix: string) {
    const user = await prisma.user.create({
      data: {
        email: `iss-0024-${suffix}-${stamp}@test.com`,
        name: `ISS-0024 ${suffix}`,
        password: "test-password-hash",
        role,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it("accepts a real client-role user", async () => {
    const client = await createUser("client", "real-client");
    const result = await resolveOrderClientId(client.id, "acting-admin");
    expect(result).toBe(client.id);
  });

  it("rejects a real but unrelated non-client user (e.g. another admin)", async () => {
    const otherAdmin = await createUser("admin", "other-admin");
    const result = await resolveOrderClientId(otherAdmin.id, "acting-admin");
    expect(result).toBeNull();
  });

  it("rejects a nonexistent user id", async () => {
    const result = await resolveOrderClientId(`no-such-user-${stamp}`, "acting-admin");
    expect(result).toBeNull();
  });

  it("returns null when no clientId was given", async () => {
    expect(await resolveOrderClientId(null, "acting-admin")).toBeNull();
  });

  it("returns null when clientId equals the acting user's own id", async () => {
    expect(await resolveOrderClientId("acting-admin", "acting-admin")).toBeNull();
  });
});
