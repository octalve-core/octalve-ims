/**
 * Admin settings section — header + SystemConfigSettings. Rendered under
 * /admin/*, which app/admin/layout.tsx already wraps in AppShell — no
 * self-wrap here (same convention as the other components/admin/*Content.tsx
 * components).
 * REQ-0024: optional initialConfigs from SSR avoids field pulse on first paint.
 */

"use client";

import { Settings } from "lucide-react";
import { PageContentWrapper, PageSectionHeader } from "@/components/shared";
import SystemConfigSettings from "@/components/admin/SystemConfigSettings";
import type { SystemConfigForPage } from "@/lib/server/system-config-data";

type AdminSettingsContentProps = {
  initialConfigs?: SystemConfigForPage | null;
};

export default function AdminSettingsContent({
  initialConfigs,
}: AdminSettingsContentProps) {
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
        <SystemConfigSettings initialConfigs={initialConfigs} />
      </div>
    </PageContentWrapper>
  );
}
