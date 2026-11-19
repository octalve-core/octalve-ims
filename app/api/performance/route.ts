/**
 * Performance Metrics API Route
 * Provides performance metrics for all API endpoints including:
 * - Response times
 * - Error rates
 * - Request counts
 * - Performance trends
 * 
 * NOTE: This API is fully functional and ready to use.
 * However, performance tracking on individual routes is deferred until
 * all other features are implemented. Once routes are wrapped with
 * withPerformanceTracking(), metrics will automatically appear here.
 * 
 * See: lib/api/performance-wrapper.ts for implementation details
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllEndpointMetrics,
  getPerformanceSummary,
  getEndpointDataPoints,
} from "@/lib/monitoring/performance";
import { successResponse, errorResponse } from "@/lib/api/response-helpers";
import { logger } from "@/lib/logger";
import { getSessionFromRequest } from "@/utils/auth";
import { isAuthorizedInternalCall } from "@/lib/api/internal-call-auth";

/**
 * GET /api/performance
 * Get performance metrics for all endpoints
 * Query params:
 *   - endpoint: Optional endpoint path to get specific metrics
 *   - method: Optional HTTP method (GET, POST, etc.)
 *   - datapoints: Optional, include data points (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    // ISS-0035: internal perf metrics shouldn't be world-readable.
    const session = await getSessionFromRequest(request);
    const isInternalCall = isAuthorizedInternalCall(
      request.headers.get("authorization"),
      process.env.INTERNAL_API_KEY,
    );
    if (!isInternalCall && (!session || session.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");
    const method = searchParams.get("method");
    const includeDataPoints = searchParams.get("datapoints") === "true";

    if (endpoint && method) {
      // Get metrics for specific endpoint
      const { getEndpointMetrics } = await import(
        "@/lib/monitoring/performance"
      );
      const metrics = await getEndpointMetrics(endpoint, method);

      if (!metrics) {
        return successResponse({
          metrics: null,
          dataPoints: [],
          message: "No metrics found for this endpoint",
        });
      }

      const dataPoints = includeDataPoints
        ? await getEndpointDataPoints(endpoint, method, 100)
        : [];

      return successResponse({
        metrics,
        dataPoints,
      });
    }

    // Get all metrics and summary
    const [allMetrics, summary] = await Promise.all([
      getAllEndpointMetrics(),
      getPerformanceSummary(),
    ]);

    return successResponse({
      summary,
      endpoints: allMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get performance metrics", { error });
    return errorResponse(
      `Failed to get performance metrics: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      500
    );
  }
}
