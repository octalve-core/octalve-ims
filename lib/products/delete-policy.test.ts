import { describe, expect, it } from "vitest";
import { getDeleteStrategy } from "./delete-policy";

describe("getDeleteStrategy", () => {
  it("returns hard when no order items", () => {
    expect(getDeleteStrategy([])).toBe("hard");
  });

  it("returns block when any order is shipped", () => {
    expect(
      getDeleteStrategy([
        { order: { id: "1", status: "shipped" } },
        { order: { id: "2", status: "delivered" } },
      ]),
    ).toBe("block");
  });

  it("returns soft when all orders are delivered or cancelled", () => {
    expect(
      getDeleteStrategy([
        { order: { id: "1", status: "delivered" } },
        { order: { id: "2", status: "cancelled" } },
      ]),
    ).toBe("soft");
  });

  it("returns block when mixed active and completed", () => {
    expect(
      getDeleteStrategy([
        { order: { id: "1", status: "pending" } },
        { order: { id: "2", status: "cancelled" } },
      ]),
    ).toBe("block");
  });
});
