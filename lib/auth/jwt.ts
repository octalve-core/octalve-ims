import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-compatible access-token signing/verification (ported from Proplity —
 * see out/auth-system-port-plan.md). Uses `jose`, not `jsonwebtoken`: the
 * old utils/auth.ts JWT layer used `jsonwebtoken`, which needs Node crypto
 * APIs unavailable on the Edge runtime — that's why proxy.ts previously
 * could only do a cookie-existence check instead of real verification.
 * `jose` runs on Edge, which is what makes real verification in proxy.ts
 * possible.
 */

export interface AccessTokenPayload {
  sub: string; // user id
  role: string; // legacy free-text fast-path role — see User.role in schema.prisma
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
    return new TextEncoder().encode(
      "dev_octalve_ims_jwt_secret_only_for_local_testing"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function verifyToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}
