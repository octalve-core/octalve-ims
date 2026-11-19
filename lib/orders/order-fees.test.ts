import { describe, expect, it } from "vitest";
import { getOrderFeesFromSubtotal } from "./order-fees";

describe("getOrderFeesFromSubtotal (ISS-0016)", () => {
  it("applies the 10% tier under $100 with free shipping", () => {
    const fees = getOrderFeesFromSubtotal(50);
    expect(fees.discountPercent).toBe(10);
    expect(fees.discountAmount).toBeCloseTo(5, 5);
    expect(fees.shippingAmount).toBe(0);
    expect(fees.taxAmount).toBeCloseTo(3.5, 5);
  });

  it("applies the 20% tier between $100 and $300 with fixed shipping", () => {
    const fees = getOrderFeesFromSubtotal(200);
    expect(fees.discountPercent).toBe(20);
    expect(fees.discountAmount).toBeCloseTo(40, 5);
    expect(fees.shippingAmount).toBe(4.99);
  });

  it("applies the 30% tier between $300 and $500", () => {
    const fees = getOrderFeesFromSubtotal(400);
    expect(fees.discountPercent).toBe(30);
    expect(fees.discountAmount).toBeCloseTo(120, 5);
    expect(fees.shippingAmount).toBe(4.99);
  });

  it("applies the 50% tier at $500 and above", () => {
    const fees = getOrderFeesFromSubtotal(1000);
    expect(fees.discountPercent).toBe(50);
    expect(fees.discountAmount).toBeCloseTo(500, 5);
    expect(fees.shippingAmount).toBe(4.99);
  });

  it("never discounts past the subtotal + tax + shipping, so total can't go negative", () => {
    for (const subtotal of [1, 50, 99.99, 100, 299.99, 300, 499.99, 500, 5000]) {
      const fees = getOrderFeesFromSubtotal(subtotal);
      const total = subtotal + fees.taxAmount + fees.shippingAmount - fees.discountAmount;
      expect(total).toBeGreaterThanOrEqual(0);
    }
  });
});
