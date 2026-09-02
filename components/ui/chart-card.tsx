import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";
import { SectionCardHeader } from "@/components/shared/SectionCardHeader";
import type { SectionHeaderTone } from "@/lib/ui/section-header-tones";

/**
 * Color variant types for chart cards
 */
type CardVariant =
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "blue"
  | "orange"
  | "teal"
  | "neutral";

interface ChartCardProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  description?: string;
  variant?: CardVariant;
}

/**
 * Card shell is a flat neutral surface for every variant (REQ-0230) — the
 * variant only selects the SectionCardHeader icon-chip tone below; it no
 * longer changes the card's own border/background/shadow.
 */

export function ChartCard({
  title,
  icon: Icon,
  children,
  className,
  description,
  variant = "neutral",
}: ChartCardProps) {
  return (
    <article
      className={cn(
        "group rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <SectionCardHeader
          title={title}
          description={description}
          icon={Icon}
          tone={variant as SectionHeaderTone}
        />
      </div>
      <div className="overflow-visible px-4 pb-4 sm:px-5 sm:pb-5 pt-1">{children}</div>
    </article>
  );
}
