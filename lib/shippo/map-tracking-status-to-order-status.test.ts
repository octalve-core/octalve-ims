import { describe, expect, it } from "vitest";
import { mapShippoStatusToOrderStatus } from "./map-tracking-status-to-order-status";

describe("mapShippoStatusToOrderStatus", () => {
  it("maps DELIVERED to delivered", () => {
    expect(mapShippoStatusToOrderStatus("DELIVERED", "shipped")).toBe("delivered");
  });

  it("maps TRANSIT to shipped", () => {
    expect(mapShippoStatusToOrderStatus("TRANSIT", "confirmed")).toBe("shipped");
  });

  it("leaves status unchanged on RETURNED or FAILURE", () => {
    expect(mapShippoStatusToOrderStatus("RETURNED", "shipped")).toBe("shipped");
    expect(mapShippoStatusToOrderStatus("FAILURE", "shipped")).toBe("shipped");
  });

  it("leaves status unchanged when verification returned nothing", () => {
    expect(mapShippoStatusToOrderStatus(undefined, "confirmed")).toBe("confirmed");
  });
});
