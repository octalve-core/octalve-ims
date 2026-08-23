import { describe, expect, it } from "vitest";
import {
  ApiError,
  getErrorHttpStatus,
  isExpectedClientError,
  isAxiosError,
} from "./errors";

describe("getErrorHttpStatus", () => {
  it("reads status from ApiError", () => {
    expect(getErrorHttpStatus(new ApiError("Conflict", 409))).toBe(409);
  });

  it("reads status from Axios-shaped error", () => {
    const axiosError = {
      isAxiosError: true,
      response: { status: 400 },
    };
    expect(isAxiosError(axiosError)).toBe(true);
    expect(getErrorHttpStatus(axiosError)).toBe(400);
  });

  it("returns undefined for plain Error", () => {
    expect(getErrorHttpStatus(new Error("fail"))).toBeUndefined();
  });
});

describe("isExpectedClientError", () => {
  it("is true for 4xx ApiError", () => {
    expect(isExpectedClientError(new ApiError("Duplicate", 409))).toBe(true);
  });

  it("is true for 400 Axios error", () => {
    expect(
      isExpectedClientError({
        isAxiosError: true,
        response: { status: 400 },
      }),
    ).toBe(true);
  });

  it("is false for 500 ApiError", () => {
    expect(isExpectedClientError(new ApiError("Server error", 500))).toBe(false);
  });

  it("is false for plain Error", () => {
    expect(isExpectedClientError(new Error("unknown"))).toBe(false);
  });
});
