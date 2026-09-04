/**
 * Statistics Card Component
 * Clean, flat KPI card — neutral surface (theme's card/border tokens), a
 * small color-tinted icon chip is the only per-card accent. Replaces the
 * earlier per-card rainbow glassmorphism treatment (REQ-0230).
 */

import React from "react";
import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataSlotPulse } from "@/components/shared/DataSlotPulse";
import { TYPO_STAT_VALUE, TYPO_SUBTITLE } from "@/lib/ui/typography-scale";
import { STAT_CARD_ICON_TINT, type StatCardTone } from "@/lib/ui/stat-card-tone";

/**
 * Color variant types for statistics cards. Kept for prop-compat with all
 * existing callers — now only tints the icon chip, not the whole card.
 */
type CardVariant = StatCardTone;

/**
 * Badge data structure
 */
interface BadgeData {
  label: string;
  value: string | number | React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

/**
 * Props for StatisticsCard component
 */
interface StatisticsCardProps {
  /**
   * Card title
   */
  title: string;
  /**
   * Main value to display (string, number, or hydration-safe client format node)
   */
  value: string | number | React.ReactNode;
  /**
   * Optional description text
   */
  description?: string;
  /**
   * Icon component from lucide-react
   */
  icon: LucideIcon;
  /**
   * Color variant for the card
   */
  variant?: CardVariant;
  /**
   * Array of badges to display below the value
   */
  badges?: BadgeData[];
  /**
   * Optional className for additional styling
   */
  className?: string;
  /**
   * When true, main value shows inline pulse (title/icon/description stay visible — REQ-0021)
   */
  valueLoading?: boolean;
  /**
   * When true, badge values pulse; badge labels remain visible
   */
  badgeValuesLoading?: boolean;
  /**
   * REQ-0171 — drop min-h-[210px] + tighter icon (forecast KPIs only)
   */
  compact?: boolean;
}

/**
 * StatisticsCard component
 * Flat card, neutral surface, tinted icon chip carries the only per-card color.
 */
export function StatisticsCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "sky",
  badges = [],
  className,
  valueLoading = false,
  badgeValuesLoading = false,
  compact = false,
}: StatisticsCardProps) {
  const tint = STAT_CARD_ICON_TINT[variant];
  const displayValue = valueLoading ? (
    <DataSlotPulse variant="metric" />
  ) : (
    value
  );

  return (
    <article
      className={cn(
        "group rounded-2xl border border-border bg-card h-full flex flex-col p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md min-w-0",
        !compact && "min-h-[210px]",
        className,
      )}
    >
      <div className="flex flex-1 flex-col min-h-0 min-w-0 w-full">
        {/* Title and icon inline so badges get full width below */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium min-w-0 break-words">
            {title}
          </p>
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl",
              tint.bg,
              compact ? "h-8 w-8" : "h-10 w-10",
            )}
          >
            <Icon
              className={cn(tint.icon, compact ? "h-4 w-4" : "h-5 w-5")}
            />
          </div>
        </div>
        <p className={cn(TYPO_STAT_VALUE, "mt-1 text-xl sm:text-2xl font-semibold")}>
          {displayValue}
        </p>
        {description && (
          <p className={cn("mt-1", TYPO_SUBTITLE)}>{description}</p>
        )}
        {badges.length > 0 && (
          <div className="mt-3 flex w-full min-w-0 flex-wrap gap-1.5">
            {/* REQ-0080 — neutral sub-badges; glass counters are section-title only (SectionCountBadge) */}
            {badges.map((badge, index) => (
              <Badge
                key={index}
                variant={badge.variant || "outline"}
                className="text-xs border-transparent bg-muted text-muted-foreground font-normal"
              >
                <span className="font-normal">{badge.label}:</span>{" "}
                <span className="ml-1">
                  {badgeValuesLoading ? (
                    <DataSlotPulse variant="badge" />
                  ) : (
                    badge.value
                  )}
                </span>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
