import { describe, expect, it } from "vitest";
import {
  createWarehouseBodySchema,
  updateWarehouseBodySchema,
} from "./warehouse";

describe("createWarehouseBodySchema", () => {
  it("accepts a valid payload", () => {
    const result = createWarehouseBodySchema.safeParse({
      name: "Main Warehouse",
      address: "123 Industrial Rd",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createWarehouseBodySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateWarehouseBodySchema", () => {
  it("requires id and name", () => {
    const result = updateWarehouseBodySchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(false);
  });

  it("accepts valid update", () => {
    const result = updateWarehouseBodySchema.safeParse({
      id: "507f1f77bcf86cd799439011",
      name: "Secondary Warehouse",
    });
    expect(result.success).toBe(true);
  });
});
