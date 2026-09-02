/**
 * REQ-0096 — shared glassmorphic card shell + body padding token.
 * shell: article border/gradient/shadow only (detail pages wrap children in GlassCardBody).
 * body: article includes p-2 sm:p-4 (order detail cards without inner wrapper).
 *
 * REQ-0230 — flat neutral surface (theme card/border tokens); each variant
 * keeps only a faint tinted border + a tinted icon chip (`iconBg`) as its
 * per-entity identity signal, replacing the earlier per-card gradient/glow.
 */

import React from "react";
import { cn } from "@/lib/utils";

export type GlassCardVariant =
  | "sky"
  | "emerald"
  | "amber"
  | "violet"
  | "blue"
  | "orange"
  | "teal"
  | "rose"
  | "cyan";

/** @deprecated Use GlassCardVariant — kept for order-detail barrel compat */
export type CardVariant = GlassCardVariant;

export const GLASS_CARD_VARIANT_CONFIG: Record<
  GlassCardVariant,
  {
    border: string;
    gradient: string;
    shadow: string;
    hoverBorder: string;
    iconBg: string;
  }
> = {
  sky: {
    border: "border-sky-200 dark:border-sky-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-sky-300 dark:hover:border-sky-700/60",
    iconBg: "border-sky-300/30 bg-sky-50 dark:bg-sky-500/10",
  },
  emerald: {
    border: "border-emerald-200 dark:border-emerald-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-700/60",
    iconBg: "border-emerald-300/30 bg-emerald-50 dark:bg-emerald-500/10",
  },
  amber: {
    border: "border-amber-200 dark:border-amber-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-amber-300 dark:hover:border-amber-700/60",
    iconBg: "border-amber-300/30 bg-amber-50 dark:bg-amber-500/10",
  },
  violet: {
    border: "border-violet-200 dark:border-violet-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-violet-300 dark:hover:border-violet-700/60",
    iconBg: "border-violet-300/30 bg-violet-50 dark:bg-violet-500/10",
  },
  blue: {
    border: "border-blue-200 dark:border-blue-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-blue-300 dark:hover:border-blue-700/60",
    iconBg: "border-blue-300/30 bg-blue-50 dark:bg-blue-500/10",
  },
  orange: {
    border: "border-orange-200 dark:border-orange-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-orange-300 dark:hover:border-orange-700/60",
    iconBg: "border-orange-300/30 bg-orange-50 dark:bg-orange-500/10",
  },
  teal: {
    border: "border-teal-200 dark:border-teal-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-teal-300 dark:hover:border-teal-700/60",
    iconBg: "border-teal-300/30 bg-teal-50 dark:bg-teal-500/10",
  },
  rose: {
    border: "border-rose-200 dark:border-rose-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-rose-300 dark:hover:border-rose-700/60",
    iconBg: "border-rose-300/30 bg-rose-50 dark:bg-rose-500/10",
  },
  cyan: {
    border: "border-cyan-200 dark:border-cyan-800/40",
    gradient: "bg-card",
    shadow: "shadow-sm",
    hoverBorder: "hover:border-cyan-300 dark:hover:border-cyan-700/60",
    iconBg: "border-cyan-300/30 bg-cyan-50 dark:bg-cyan-500/10",
  },
};

/** @deprecated Use GLASS_CARD_VARIANT_CONFIG */
export const variantConfig = GLASS_CARD_VARIANT_CONFIG;

export type GlassCardProps = {
  children: React.ReactNode;
  variant?: GlassCardVariant;
  className?: string;
  /** shell = no article padding; body = p-2 sm:p-4 on article */
  padding?: "shell" | "body";
};

export function GlassCard({
  children,
  variant = "blue",
  className,
  padding = "shell",
}: GlassCardProps) {
  const config = GLASS_CARD_VARIANT_CONFIG[variant];
  return (
    <article
      className={cn(
        "group rounded-2xl border transition-shadow duration-300 overflow-hidden",
        padding === "body" && "p-2 sm:p-4",
        config.border,
        config.gradient,
        config.shadow,
        config.hoverBorder,
        className,
      )}
    >
      {children}
    </article>
  );
}

/** Canonical inner padding for shell-mode GlassCard (REQ-0095). */
export function GlassCardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-2 sm:p-4", className)}>{children}</div>;
}
