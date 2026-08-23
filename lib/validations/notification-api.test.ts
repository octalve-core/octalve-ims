import { describe, expect, it } from "vitest";
import {
  updateInAppNotificationBodySchema,
  emailNotificationBodySchema,
} from "./notification";

describe("updateInAppNotificationBodySchema", () => {
  it("requires boolean read", () => {
    expect(updateInAppNotificationBodySchema.safeParse({}).success).toBe(false);
  });

  it("accepts read true", () => {
    expect(
      updateInAppNotificationBodySchema.safeParse({ read: true }).success,
    ).toBe(true);
  });
});

describe("emailNotificationBodySchema", () => {
  it("accepts valid email notification", () => {
    const result = emailNotificationBodySchema.safeParse({
      type: "low_stock_alert",
      recipientEmail: "admin@example.com",
      data: { productName: "Widget", currentQuantity: 5, threshold: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = emailNotificationBodySchema.safeParse({
      type: "low_stock_alert",
      recipientEmail: "not-an-email",
      data: {},
    });
    expect(result.success).toBe(false);
  });
});
