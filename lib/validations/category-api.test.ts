import { describe, expect, it } from "vitest";
import {
  createCategoryBodySchema,
  updateCategoryBodySchema,
} from "./category";

describe("createCategoryBodySchema", () => {
  it("accepts a valid payload", () => {
    const result = createCategoryBodySchema.safeParse({ name: "Electronics" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createCategoryBodySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = createCategoryBodySchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });
});

describe("updateCategoryBodySchema", () => {
  it("requires id and name", () => {
    const result = updateCategoryBodySchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(false);
  });

  it("accepts valid update", () => {
    const result = updateCategoryBodySchema.safeParse({
      id: "507f1f77bcf86cd799439011",
      name: "Updated",
    });
    expect(result.success).toBe(true);
  });
});
