"use client";

import { AuthInfoListItem } from "@/components/auth/AuthInfoListItem";
import { AuthAnimatedBlock } from "@/components/auth/AuthAnimatedBlock";
import { AUTH_STAGGER_MS } from "@/components/auth/auth-animation";
import { getAuthPanelCopy } from "@/lib/auth/auth-panel-copy";
import type { AuthGlassVariant } from "@/components/auth/auth-glass-styles";

type AuthInfoPanelProps = {
  variant: AuthGlassVariant;
};

/**
 * REQ-0231 — Suite Portal reskin: content for the navy side panel,
 * rendered by AuthPageShell in place of Suite Portal's AuthSidePanel
 * photo + floating quote card. IMS has 6 role/feature rows to surface
 * (vs. Suite Portal's single quote), so the floating glass card holds the
 * eyebrow/title/lead (matching AuthSidePanel's card exactly) and the rows
 * fill the panel below it — the closest fit for this content on that
 * layout, not a departure from it.
 */
export function AuthInfoPanel({ variant }: AuthInfoPanelProps) {
  const { sectionTitle, sectionLead, items } = getAuthPanelCopy(variant);

  return (
    <div className="flex h-full flex-col">
      <AuthAnimatedBlock delayMs={AUTH_STAGGER_MS * 1}>
        <div className="rounded-[22px] bg-white/95 p-7 text-slate-950 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#0064E0]">
            Welcome to Octalve IMS
          </p>
          <h2 className="text-[28px] font-semibold leading-[1.12] tracking-[-0.03em] text-black">
            {sectionTitle}
          </h2>
          <p className="mt-3 text-[15px] font-medium leading-[1.45] text-black/70">
            {sectionLead}
          </p>
        </div>
      </AuthAnimatedBlock>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <AuthInfoListItem key={item.id} item={item} staggerIndex={2 + index} />
        ))}
      </div>
    </div>
  );
}
