/**
 * Horizontal scroll for wide tables inside dialogs.
 * Uses ring + shadow-sm on the frame (see DIALOG_TABLE_FRAME_*); large box-shadows clip under overflow.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DialogTableScrollAreaProps = {
  children: ReactNode;
  /** Visual frame — prefer DIALOG_TABLE_FRAME_SKY / DIALOG_TABLE_FRAME_EMERALD */
  frameClassName?: string;
};

export function DialogTableScrollArea({
  children,
  frameClassName,
}: DialogTableScrollAreaProps) {
  return (
    <div
      className="min-w-0 max-w-full overflow-x-auto"
      role="region"
      aria-label="Scrollable table"
    >
      <div
        className={cn(
          frameClassName,
          /* Table root is div.overflow-auto; parent scroll handles x-axis */
          "[&>div]:overflow-visible",
        )}
      >
        {children}
      </div>
    </div>
  );
}
