/**
 * ImageKit error classification for non-critical cleanup (e.g. file already deleted).
 */

/** True when ImageKit file was already removed (404 / not found). */
export function isImageKitNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("404") ||
      msg.includes("does not exist") ||
      msg.includes("not found")
    );
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    if (record.status === 404 || record.statusCode === 404) {
      return true;
    }
  }

  return false;
}
