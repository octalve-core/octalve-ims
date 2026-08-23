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
 * pattern ported from Proplity — see out/auth-system-port-plan.md, Phase 4.
 */

const axiosInstance = axios.create({
  baseURL:
    process.env.NODE_ENV === "production"
      ? "https://stockly-inventory.vercel.app/api" // Production URL
      : "http://localhost:3000/api", // Localhost for development
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Ensure cookies are sent with requests
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const isRefreshCall =
      typeof originalRequest?.url === "string" &&
      originalRequest.url.includes("/auth/refresh");

    if (
      error?.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshCall
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
