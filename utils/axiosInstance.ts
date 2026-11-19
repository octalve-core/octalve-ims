import axios from "axios";
import { refreshAccessToken } from "@/lib/auth/refresh-client";

/**
 * The old request interceptor here read the (previously non-httpOnly)
 * `session_id` cookie and manually attached it as `Authorization: Bearer`.
 * That's gone: `access_token` is httpOnly (invisible to JS by design) and
 * `withCredentials: true` already sends it automatically — no route ever
 * checked the Authorization header for user sessions (grepped to confirm;
 * the one hit elsewhere in the codebase is an unrelated internal-cron-key
 * check), so that header was dead weight even before this port. The 401
 * response interceptor below adds the single-flight refresh-and-retry
 * pattern ported from Proplity — see docs/auth-system-port-plan.md, Phase 4.
 */

const axiosInstance = axios.create({
  // Relative — this instance is client-only and always calls the same
  // Next.js app's own /api routes, so same-origin is guaranteed and no
  // hardcoded host/port is needed (a hardcoded "localhost:3000" broke every
  // request whenever the dev server had to bind to a different port because
  // 3000 was already taken by another project).
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Ensure cookies are sent with requests
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    // Every /auth/* route (login, register, refresh, ...) answers its own 401s directly — a
    // wrong password on login, for instance, is not an expired session. Treating it like one
    // used to fire a pointless refresh attempt and then hard-redirect away from the login form
    // before the real "Invalid email or password" error ever reached it (ISS-0030, decision d).
    const isAuthCall =
      typeof originalRequest?.url === "string" &&
      originalRequest.url.includes("/auth/");

    if (
      error?.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthCall
    ) {
      originalRequest._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return axiosInstance(originalRequest);
      }
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
