"use client";

import type { ReactNode } from "react";
import { ShellSsrProvider, useShellSsr } from "@/contexts/shell-ssr-context";
import type { AdminCounts } from "@/types";

/**
 * Merges SSR-fetched admin sidebar counts into the root ShellSsrProvider's
 * value (notifications etc.) rather than replacing it — nested
 * ShellSsrProvider values don't merge automatically. Lets app/admin/layout.tsx
 * (a server component) hand off `initialAdminCounts` to AppSidebar without
 * prop-drilling through every admin page component.
 */
export function AdminShellSsrMerge({
  initialAdminCounts,
  children,
}: {
  initialAdminCounts?: AdminCounts;
  children: ReactNode;
}) {
  const outer = useShellSsr();
  return (
    <ShellSsrProvider value={{ ...outer, initialAdminCounts }}>
      {children}
    </ShellSsrProvider>
  );
}
