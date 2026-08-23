import { describe, expect, it } from "vitest";
import { updateSystemConfigsBodySchema } from "./system-config";

describe("updateSystemConfigsBodySchema", () => {
  it("accepts valid configs array", () => {
    const result = updateSystemConfigsBodySchema.safeParse({
      configs: [{ key: "app.name", value: "Stockly" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty configs", () => {
    expect(updateSystemConfigsBodySchema.safeParse({ configs: [] }).success).toBe(
      false,
    );
  });

  it("rejects missing key", () => {
    expect(
      updateSystemConfigsBodySchema.safeParse({
        configs: [{ key: "", value: "x" }],
      }).success,
    ).toBe(false);
  });
});
