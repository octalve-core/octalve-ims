import { describe, it, expect } from "vitest";
import {
  generateOrderConfirmationEmail,
  generateInvoiceEmail,
  generateShippingNotificationEmail,
  generateOrderStatusUpdateEmail,
} from "./templates-order";

/**
 * ISS-0037: every free-text field here (a name, an address line, a product name/
 * description, a carrier) traces back to something someone typed, not a system value —
 * interpolating it into htmlContent unescaped lets it break out of its tag. textContent
 * is plain text, so it must keep the raw value (escaping it there would show literal
 * "&amp;" to the reader).
 */

const XSS_NAME = '<img src=x onerror=alert(1)>Mallory & "Sons"';
const ESCAPED_NAME =
  "&lt;img src=x onerror=alert(1)&gt;Mallory &amp; &quot;Sons&quot;";

describe("generateOrderConfirmationEmail (ISS-0037)", () => {
  const baseData = {
    orderNumber: "ORD-1",
    orderDate: "2026-11-06",
    clientName: XSS_NAME,
    clientEmail: "buyer@example.com",
    items: [
      {
        productName: XSS_NAME,
        sku: "SKU-1",
        quantity: 1,
        price: 10,
        subtotal: 10,
      },
    ],
    subtotal: 10,
    total: 10,
    shippingAddress: {
      street: XSS_NAME,
      city: "Lagos",
      zipCode: "100001",
      country: "Nigeria",
    },
    orderStatus: "confirmed" as const,
  };

  it("escapes clientName, shippingAddress and item.productName in htmlContent", () => {
    const { htmlContent } = generateOrderConfirmationEmail(baseData);
    expect(htmlContent).not.toContain(XSS_NAME);
    expect(htmlContent).toContain(ESCAPED_NAME);
    expect(htmlContent).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("keeps the raw value in textContent", () => {
    const { textContent } = generateOrderConfirmationEmail(baseData);
    expect(textContent).toContain(XSS_NAME);
  });
});

describe("generateInvoiceEmail (ISS-0037)", () => {
  const baseData = {
    invoiceNumber: "INV-1",
    invoiceDate: "2026-11-06",
    dueDate: "2026-11-20",
    clientName: XSS_NAME,
    clientEmail: "buyer@example.com",
    orderNumber: "ORD-1",
    items: [
      {
        description: XSS_NAME,
        quantity: 1,
        unitPrice: 10,
        subtotal: 10,
      },
    ],
    subtotal: 10,
    total: 10,
    amountPaid: 0,
    amountDue: 10,
    status: "sent" as const,
  };

  it("escapes clientName and item.description in htmlContent only", () => {
    const { htmlContent, textContent } = generateInvoiceEmail(baseData);
    expect(htmlContent).not.toContain(XSS_NAME);
    expect(htmlContent).toContain(ESCAPED_NAME);
    expect(textContent).toContain(XSS_NAME);
  });
});

describe("generateShippingNotificationEmail (ISS-0037)", () => {
  const baseData = {
    orderNumber: "ORD-1",
    clientName: XSS_NAME,
    clientEmail: "buyer@example.com",
    trackingNumber: XSS_NAME,
    carrier: XSS_NAME,
    shippingDate: "2026-11-06",
    estimatedDelivery: "2026-11-10",
    shippingAddress: {
      street: XSS_NAME,
      city: "Lagos",
      zipCode: "100001",
      country: "Nigeria",
    },
    items: [{ productName: XSS_NAME, quantity: 1 }],
  };

  it("escapes every free-text field in htmlContent only", () => {
    const { htmlContent, textContent } =
      generateShippingNotificationEmail(baseData);
    expect(htmlContent).not.toContain(XSS_NAME);
    expect(htmlContent).toContain(ESCAPED_NAME);
    expect(textContent).toContain(XSS_NAME);
  });
});

describe("generateOrderStatusUpdateEmail (ISS-0037)", () => {
  const baseData = {
    orderNumber: "ORD-1",
    clientName: XSS_NAME,
    clientEmail: "buyer@example.com",
    previousStatus: "pending",
    newStatus: "confirmed",
    statusMessage: XSS_NAME,
  };

  it("escapes clientName and statusMessage in htmlContent only", () => {
    const { htmlContent, textContent } = generateOrderStatusUpdateEmail(baseData);
    expect(htmlContent).not.toContain(XSS_NAME);
    expect(htmlContent).toContain(ESCAPED_NAME);
    expect(textContent).toContain(XSS_NAME);
  });
});
