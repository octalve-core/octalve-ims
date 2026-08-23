import { describe, expect, it } from "vitest";
import { isImageKitNotFoundError } from "./imagekit-errors";

describe("isImageKitNotFoundError", () => {
  it("detects 404 in message", () => {
    expect(
      isImageKitNotFoundError(
        new Error("Failed to delete: 404 The requested file does not exist."),
      ),
    ).toBe(true);
  });

  it("detects not found wording", () => {
    expect(isImageKitNotFoundError(new Error("file not found"))).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isImageKitNotFoundError(new Error("500 Internal Server Error"))).toBe(
      false,
    );
  });
});
