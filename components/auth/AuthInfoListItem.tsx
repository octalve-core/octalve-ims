"use client";

import type { AuthPanelListItem } from "@/lib/auth/auth-panel-copy";
import { cn } from "@/lib/utils";
import { AuthAnimatedBlock } from "@/components/auth/AuthAnimatedBlock";
import { AUTH_STAGGER_MS } from "@/components/auth/auth-animation";
import { AUTH_LIST_ICON_STYLES } from "@/components/auth/auth-list-styles";
import { AUTH_LIST_ROW_GLASS } from "@/components/auth/auth-glass-styles";

type AuthInfoListItemProps = {
  item: AuthPanelListItem;
  staggerIndex: number;
};

/**
 * REQ-0231 — Suite Portal reskin: row inside the navy side-panel feature
 * list (white text on dark, flat icon wrap) replacing the old light-glass
 * row meant for the light AuthInfoPanel column.
 */
export function AuthInfoListItem({ item, staggerIndex }: AuthInfoListItemProps) {
  const { icon: Icon, hue, title, description } = item;
  const styles = AUTH_LIST_ICON_STYLES[hue];

  return (
    <AuthAnimatedBlock delayMs={staggerIndex * AUTH_STAGGER_MS}>
      <div className={cn(AUTH_LIST_ROW_GLASS)}>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            styles.wrap,
          )}
        >
          <Icon className={cn("h-[18px] w-[18px]", styles.icon)} />
        </div>
        <div className="min-w-0 space-y-0.5 text-left">
          <h3 className="text-[13px] font-semibold leading-snug text-white">
            {title}
          </h3>
          <p className="text-[12.5px] leading-snug text-white/60">
            {description}
          </p>
        </div>
      </div>
    </AuthAnimatedBlock>
  );
}
