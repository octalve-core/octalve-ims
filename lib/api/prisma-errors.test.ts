import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { isPrismaRelationViolation } from "./prisma-errors";

describe("isPrismaRelationViolation", () => {
  it("detects P2014", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "violate the required relation",
      { code: "P2014", clientVersion: "6.19.3" },
    );
    expect(isPrismaRelationViolation(error)).toBe(true);
  });

  it("detects message fallback", () => {
    expect(
      isPrismaRelationViolation(
        new Error(
          "The change you are trying to make would violate the required relation",
        ),
      ),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isPrismaRelationViolation(new Error("Something else"))).toBe(false);
  });
});
