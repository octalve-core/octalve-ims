/**
 * Client-safe auth utilities
 * These functions can be safely imported in client components
 */

import { User } from "@/types";

/**
 * A definite "no" (401/403: the server looked at the cookie and rejected it)
 * is the only case that should log the client out. Anything else — a 5xx,
 * a network blip — says nothing about whether the session is actually
 * invalid, so callers must not treat it the same as a real sign-out
 * (ISS-0050: a transient failure used to clear every logged-in user's auth
 * state and localStorage, logging them out over a blip that had nothing to
 * do with their session).
 */
export type SessionCheckResult = User | null | "indeterminate";

/**
 * Get session from client-side
 * Makes an API call to verify the token
 * Note: access_token cookie is httpOnly, so it can't be read from JS directly
 * We rely on credentials: "include" to automatically send the cookie with the request
 */
export const getSessionClient = async (): Promise<SessionCheckResult> => {
  let response: Response;
  try {
    // Note: access_token cookie is httpOnly, can't be read directly from JS
    // We must make the API call with credentials: "include" to send the cookie
    // The API will verify the cookie server-side

    // On client side, we'll make an API call to verify the token
    // This avoids using the JWT library on the client side
    response = await fetch("/api/auth/session", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies (including httpOnly cookies)
    });
  } catch (error) {
    return "indeterminate";
  }

  if (response.ok) {
    const user = await response.json();
    return user;
  }

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  return "indeterminate";
};
