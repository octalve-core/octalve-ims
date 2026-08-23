import { describe, expect, it } from "vitest";
import {
  getRatesBodySchema,
  generateLabelBodySchema,
  addTrackingBodySchema,
} from "./shipping";

const validAddress = {
  street1: "123 Main St",
  city: "Boston",
  state: "MA",
  zip: "02101",
  country: "US",
};

describe("getRatesBodySchema", () => {
  it("accepts valid rates request", () => {
    const result = getRatesBodySchema.safeParse({ toAddress: validAddress });
    expect(result.success).toBe(true);
  });

  it("rejects missing toAddress fields", () => {
    const result = getRatesBodySchema.safeParse({
      toAddress: { street1: "", city: "Boston", state: "MA", zip: "02101" },
    });
    expect(result.success).toBe(false);
  });
});

describe("generateLabelBodySchema", () => {
  it("requires orderId", () => {
    expect(generateLabelBodySchema.safeParse({}).success).toBe(false);
  });

  it("accepts orderId", () => {
    expect(
      generateLabelBodySchema.safeParse({
        orderId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(true);
  });
});

describe("addTrackingBodySchema", () => {
  it("requires orderId and trackingNumber", () => {
    expect(
      addTrackingBodySchema.safeParse({ orderId: "abc" }).success,
    ).toBe(false);
  });

  it("accepts valid tracking payload", () => {
    expect(
      addTrackingBodySchema.safeParse({
        orderId: "507f1f77bcf86cd799439011",
        trackingNumber: "1Z999AA10123456784",
      }).success,
    ).toBe(true);
  });
});
