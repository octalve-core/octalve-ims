import { describe, expect, it } from "vitest";
import { aiInsightsBodySchema } from "./ai";

describe("aiInsightsBodySchema", () => {
  it("accepts non-empty summary", () => {
    expect(
      aiInsightsBodySchema.safeParse({ summary: "10 products low stock" }).success,
    ).toBe(true);
  });

  it("rejects empty summary", () => {
    expect(aiInsightsBodySchema.safeParse({ summary: "" }).success).toBe(false);
  });

  it("rejects whitespace-only summary", () => {
    expect(aiInsightsBodySchema.safeParse({ summary: "   " }).success).toBe(false);
  });
});
