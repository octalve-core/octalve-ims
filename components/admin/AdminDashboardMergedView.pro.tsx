"use client";

import React from "react";
import { PageContentWrapper } from "@/components/shared";
import AdminAnalyticsContent from "./AdminAnalyticsContent";
import type { DashboardStats } from "@/types";

export type AdminDashboardMergedViewProps = {
  variant: "store" | "personal";
  /** SSR-passed dashboard stats (REQ-0021) */
  initialStats?: DashboardStats | null;
};

/**
 * Merged dashboard: overview (KPIs + recent orders) + analytics (charts, AI).
 * Pro tier variant (identical to the Core variant) — no AI demand
 * forecasting (lib/forecasting is premium-only), so no initialForecasting
 * prop (its callers already don't pass one — see
 * app/admin/dashboard-overall-insights/page.pro.tsx). Keep in sync with
 * AdminDashboardMergedView.core.tsx.
 */
export default function AdminDashboardMergedView({
  variant,
  initialStats,
}: AdminDashboardMergedViewProps) {
  return (
    <PageContentWrapper noPadding={variant === "store"}>
      <div className="space-y-4">
        <AdminAnalyticsContent initialStats={initialStats} />
      </div>
    </PageContentWrapper>
  );
}
