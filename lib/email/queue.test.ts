import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ISS-0038: sendEmailDirectly only checked user preferences for 2 of its 6 job types
 * (low_stock_alert, stock_out_notification) — order_confirmation, invoice_email,
 * shipping_notification and order_status_update sent regardless of an opted-out
 * preference, even though mapNotificationTypeToPreference already had entries for all
 * six. The fix hoists one preference check, by the mapped key, above the switch.
 */

const { isBrevoConfigured, sendEmailViaBrevo, isEmailNotificationEnabled } =
  vi.hoisted(() => ({
    isBrevoConfigured: vi.fn(),
    sendEmailViaBrevo: vi.fn(),
    isEmailNotificationEnabled: vi.fn(),
  }));

vi.mock("./brevo", () => ({
  isBrevoConfigured,
  sendEmailViaBrevo,
  getAdminEmail: vi.fn(),
}));
vi.mock("./preferences", () => ({
  isEmailNotificationEnabled,
  mapNotificationTypeToPreference: (type: string) =>
    ({
      low_stock_alert: "lowStockAlerts",
      stock_out_notification: "stockOutNotifications",
      order_confirmation: "orderConfirmations",
      invoice_email: "invoiceEmails",
      shipping_notification: "shippingNotifications",
      order_status_update: "orderStatusUpdates",
    })[type] ?? null,
}));
vi.mock("@/lib/queue/qstash", () => ({
  getQStash: vi.fn(),
  isQStashConfigured: vi.fn(() => false),
}));
vi.mock("@/lib/env", () => ({ getApiUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { sendEmailDirectly } from "./queue";

beforeEach(() => {
  vi.clearAllMocks();
  isBrevoConfigured.mockReturnValue(true);
  sendEmailViaBrevo.mockResolvedValue({ success: true, messageId: "m1" });
});

const orderConfirmationJob = {
  type: "order_confirmation" as const,
  data: {
    orderNumber: "ORD-1",
    orderDate: "2026-11-06",
    clientName: "Buyer",
    clientEmail: "buyer@example.com",
    items: [],
    subtotal: 0,
    total: 0,
    orderStatus: "confirmed" as const,
  },
  recipientEmail: "buyer@example.com",
  recipientName: "Buyer",
  userId: "u1",
};

describe("sendEmailDirectly preference gate (ISS-0038)", () => {
  it("skips sending a transactional email type when the user opted out", async () => {
    isEmailNotificationEnabled.mockResolvedValue(false);

    await sendEmailDirectly(orderConfirmationJob);

    expect(isEmailNotificationEnabled).toHaveBeenCalledWith(
      "u1",
      "orderConfirmations",
    );
    expect(sendEmailViaBrevo).not.toHaveBeenCalled();
  });

  it("sends when the user has not opted out", async () => {
    isEmailNotificationEnabled.mockResolvedValue(true);

    await sendEmailDirectly(orderConfirmationJob);

    expect(sendEmailViaBrevo).toHaveBeenCalledTimes(1);
  });

  it("sends without checking preferences when no userId is attached to the job", async () => {
    await sendEmailDirectly({ ...orderConfirmationJob, userId: undefined });

    expect(isEmailNotificationEnabled).not.toHaveBeenCalled();
    expect(sendEmailViaBrevo).toHaveBeenCalledTimes(1);
  });
});
