import { describe, expect, it } from "vitest";
import { redactBuyerForViewer } from "./catalog-buyer-privacy";

const buyer = { id: "buyer-1", name: "Buyer", email: "buyer@test.com", image: null };

describe("redactBuyerForViewer (ISS-0018)", () => {
  it("redacts the buyer to null for a client viewer", () => {
    expect(redactBuyerForViewer(buyer, { id: "v1", role: "client" })).toBeNull();
  });

  it("passes the buyer through unchanged for admin", () => {
    expect(redactBuyerForViewer(buyer, { id: "v1", role: "admin" })).toEqual(buyer);
  });

  it("passes the buyer through unchanged for supplier", () => {
    expect(redactBuyerForViewer(buyer, { id: "v1", role: "supplier" })).toEqual(buyer);
  });

  it("passes the buyer through unchanged for the owning staff role", () => {
    expect(redactBuyerForViewer(buyer, { id: "v1", role: "user" })).toEqual(buyer);
  });

  it("passes through null unchanged regardless of role", () => {
    expect(redactBuyerForViewer(null, { id: "v1", role: "client" })).toBeNull();
  });
});
