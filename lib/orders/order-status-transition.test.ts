import { describe, expect, it } from "vitest";
import { assertValidOrderStatusTransition } from "./order-status-transition";

function expectOk(args: { previousStatus: string; newStatus: string; newPaymentStatus: string }) {
  expect(() => assertValidOrderStatusTransition(args)).not.toThrow();
}
function expectRejected(args: { previousStatus: string; newStatus: string; newPaymentStatus: string }) {
  expect(() => assertValidOrderStatusTransition(args)).toThrow();
}

describe("assertValidOrderStatusTransition", () => {
  it("allows the normal forward progression", () => {
    expectOk({ previousStatus: "pending", newStatus: "confirmed", newPaymentStatus: "unpaid" });
    expectOk({ previousStatus: "confirmed", newStatus: "processing", newPaymentStatus: "paid" });
    expectOk({ previousStatus: "processing", newStatus: "shipped", newPaymentStatus: "paid" });
    expectOk({ previousStatus: "shipped", newStatus: "delivered", newPaymentStatus: "paid" });
  });

  it("allows cancelling a pending (unpaid) order", () => {
    expectOk({ previousStatus: "pending", newStatus: "cancelled", newPaymentStatus: "unpaid" });
  });

  it("allows a no-op update that doesn't change status", () => {
    expectOk({ previousStatus: "shipped", newStatus: "shipped", newPaymentStatus: "paid" });
  });

  it("rejects confirmed -> pending (Failure: double-decrement via confirm/pending/confirm)", () => {
    expectRejected({ previousStatus: "confirmed", newStatus: "pending", newPaymentStatus: "paid" });
  });

  it("rejects cancelling a confirmed/paid order through this generic path", () => {
    expectRejected({ previousStatus: "confirmed", newStatus: "cancelled", newPaymentStatus: "paid" });
    expectRejected({ previousStatus: "shipped", newStatus: "cancelled", newPaymentStatus: "paid" });
  });

  it("rejects any status change away from delivered (Failure: cancelling a delivered order restores stock)", () => {
    expectRejected({ previousStatus: "delivered", newStatus: "cancelled", newPaymentStatus: "paid" });
    expectRejected({ previousStatus: "delivered", newStatus: "confirmed", newPaymentStatus: "paid" });
  });

  it("rejects any status change away from cancelled (Failure: cancelled orders revive)", () => {
    expectRejected({ previousStatus: "cancelled", newStatus: "confirmed", newPaymentStatus: "unpaid" });
    expectRejected({ previousStatus: "cancelled", newStatus: "pending", newPaymentStatus: "unpaid" });
  });

  it("rejects reviving a cancelled order via paymentStatus alone, status unchanged (Failure: ISS-0015)", () => {
    expectRejected({ previousStatus: "cancelled", newStatus: "cancelled", newPaymentStatus: "paid" });
  });

  it("rejects skipping stages (pending -> shipped)", () => {
    expectRejected({ previousStatus: "pending", newStatus: "shipped", newPaymentStatus: "unpaid" });
  });
});
