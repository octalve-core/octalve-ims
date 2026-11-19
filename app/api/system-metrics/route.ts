/**
 * System Metrics API Route
 * Provides system-level metrics including:
 * - Cache hit/miss rates
 * - Database performance statistics
 * - System resource usage (memory, CPU, uptime)
 * - Node.js process information
 */

import { NextRequest, NextResponse } from "next/server";
import { getSystemMetrics } from "@/lib/monitoring/system-metrics";
import { successResponse, errorResponse } from "@/lib/api/response-helpers";
import { logger } from "@/lib/logger";
import { getSessionFromRequest } from "@/utils/auth";
import { isAuthorizedInternalCall } from "@/lib/api/internal-call-auth";

/**
 * GET /api/system-metrics
 * Get comprehensive system metrics
 */
export async function GET(request: NextRequest) {
  try {
    // ISS-0035: cache/DB/resource metrics shouldn't be world-readable.
    const session = await getSessionFromRequest(request);
    const isInternalCall = isAuthorizedInternalCall(
      request.headers.get("authorization"),
      process.env.INTERNAL_API_KEY,
    );
    if (!isInternalCall && (!session || session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metrics = await getSystemMetrics();
    return successResponse(metrics);
  } catch (error) {
    logger.error("Failed to get system metrics", { error });
    return errorResponse(
      `Failed to get system metrics: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      500
    );
  }
}
