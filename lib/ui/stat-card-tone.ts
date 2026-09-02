/**
 * REQ-0230 — shared icon-chip tint used by StatisticsCard, AnalyticsCard, and
 * QuickAccessGrid. Each card's SURFACE is neutral (theme card/border tokens);
 * this is the only per-card color left, kept small and consistent so a
 * dashboard full of these reads as one system, not a rainbow of gradients.
 */

export type StatCardTone =
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "blue"
  | "orange"
  | "teal"
  | "cyan";

export const STAT_CARD_ICON_TINT: Record<
  StatCardTone,
  { bg: string; icon: string }
> = {
  sky: { bg: "bg-sky-50 dark:bg-sky-500/10", icon: "text-sky-600 dark:text-sky-400" },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-400",
  },
  rose: { bg: "bg-rose-50 dark:bg-rose-500/10", icon: "text-rose-600 dark:text-rose-400" },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    icon: "text-violet-600 dark:text-violet-400",
  },
  blue: { bg: "bg-blue-50 dark:bg-blue-500/10", icon: "text-blue-600 dark:text-blue-400" },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-500/10",
    icon: "text-orange-600 dark:text-orange-400",
  },
  teal: { bg: "bg-teal-50 dark:bg-teal-500/10", icon: "text-teal-600 dark:text-teal-400" },
  cyan: { bg: "bg-cyan-50 dark:bg-cyan-500/10", icon: "text-cyan-600 dark:text-cyan-400" },
};
