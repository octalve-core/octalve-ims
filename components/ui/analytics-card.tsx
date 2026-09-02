import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { DataSlotPulse } from "@/components/shared/DataSlotPulse";
import { TYPO_STAT_VALUE, TYPO_SUBTITLE } from "@/lib/ui/typography-scale";
import { STAT_CARD_ICON_TINT, type StatCardTone } from "@/lib/ui/stat-card-tone";

/**
 * Color variant types for analytics cards (matching StatisticsCard). Kept
 * for prop-compat with all existing callers — now only tints the icon
 * chip, not the whole card (REQ-0230).
 */
type CardVariant = StatCardTone;

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconColor?: string;
  variant?: CardVariant;
  /** When true, value shows inline pulse (title/icon stay visible — REQ-0021) */
  valueLoading?: boolean;
}

/**
 * Flat card, neutral surface, tinted icon chip carries the only per-card color.
 */
export function AnalyticsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconColor,
  variant = "blue",
  valueLoading = false,
}: AnalyticsCardProps) {
  const tint = STAT_CARD_ICON_TINT[variant];

  return (
    <article
      className={cn(
        "group rounded-2xl border border-border bg-card min-h-[140px] h-full p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="flex flex-col w-full">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium shrink-0">
            {title}
          </p>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              tint.bg,
            )}
          >
            <Icon className={cn("h-5 w-5", iconColor ?? tint.icon)} />
          </div>
        </div>
        <p className={cn(TYPO_STAT_VALUE, "mt-1 text-xl sm:text-2xl font-semibold")}>
          {valueLoading ? <DataSlotPulse variant="metric" /> : value}
        </p>
        {description && (
          <p className={cn("mt-1", TYPO_SUBTITLE)}>{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            <span
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              from last month
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
