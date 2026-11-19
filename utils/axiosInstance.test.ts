import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";

/**
 * ISS-0030 (decision d): a wrong password on login got a 401 from
 * /api/auth/login, which this interceptor used to treat like any other
 * 401 — try a refresh, then hard-redirect to "/" if that failed — instead
 * of letting the real "Invalid email or password" error reach the login
 * form. /auth/* routes answer their own 401s directly and must never
 * trigger the refresh-then-redirect flow meant for an expired session on a
 * protected route.
 */

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/auth/refresh-client", () => ({ refreshAccessToken: refresh }));

import axiosInstance from "./axiosInstance";

// A custom axios adapter is responsible for its own status-based rejection — axios does not
// settle() a raw adapter's response for you, unlike its built-in http/xhr adapters.
function statusAdapter(statusByUrl: Record<string, number>) {
  return async (config: InternalAxiosRequestConfig) => {
    const status = statusByUrl[config.url ?? ""] ?? 200;
    const response = { data: {}, status, statusText: "", headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return response;
    return Promise.reject({
      isAxiosError: true,
      message: `Request failed with status code ${status}`,
      config,
      response,
    });
  };
}

describe("axiosInstance response interceptor", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it("does not attempt a refresh for a 401 from an /auth/* route (ISS-0030)", async () => {
    axiosInstance.defaults.adapter = statusAdapter({ "/auth/login": 401 });

    await expect(
      axiosInstance.post("/auth/login", { email: "a@b.com", password: "wrong" }),
    ).rejects.toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("still attempts a refresh for a 401 from an ordinary protected route", async () => {
    axiosInstance.defaults.adapter = statusAdapter({ "/products": 401 });
    refresh.mockResolvedValue(false);

    await expect(axiosInstance.get("/products")).rejects.toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
