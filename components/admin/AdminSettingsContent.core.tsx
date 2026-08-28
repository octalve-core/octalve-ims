/**
 * Admin settings section — Core tier variant. System configuration
 * management (components/admin/SystemConfigSettings.tsx) is a Pro+
 * feature; Core shows an upsell placeholder instead of the settings form.
 */

"use client";

import { Lock, Settings } from "lucide-react";
import { PageContentWrapper, PageSectionHeader } from "@/components/shared";

export default function AdminSettingsContent() {
  return (
    <PageContentWrapper>
      <div className="space-y-4">
        <PageSectionHeader
          as="h1"
          icon={Settings}
          tone="blue"
          title="System Settings"
          description="Configure application-wide settings"
        />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-semibold">System settings is a Pro feature</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Upgrade to Pro to customize company info, notification defaults,
            and appearance settings from here.
          </p>
        </div>
      </div>
    </PageContentWrapper>
  );
}
