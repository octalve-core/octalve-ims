/**
 * Icon-tile "quick access" module launcher for dashboard home pages.
 * Additive alongside the existing KPI/analytics sections — not a replacement.
 * Each module keeps a fixed color (not the user's editable accent), same
 * spirit as the reference launcher-grid pattern this was modeled on.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GLASS_CARD_VARIANT_CONFIG } from "@/lib/ui/glass-card";
import { TYPO_CARD_TITLE } from "@/lib/ui/typography-scale";
import {
  getQuickAccessTiles,
  type QuickAccessTile,
} from "@/lib/navigation/quick-access-tiles";

function QuickAccessTileLink({ label, path, icon: Icon, tone }: QuickAccessTile) {
  const config = GLASS_CARD_VARIANT_CONFIG[tone];
  return (
    <Link
      href={path}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-[20px] border p-3 sm:p-4 text-center backdrop-blur-md transition-all duration-300",
        config.border,
        config.gradient,
        config.shadow,
        config.hoverBorder,
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border",
          config.iconBg,
        )}
      >
        <Icon className="h-5 w-5 text-gray-700 dark:text-white" aria-hidden />
      </span>
      <span className={cn(TYPO_CARD_TITLE, "line-clamp-2")}>{label}</span>
    </Link>
  );
}

export function QuickAccessGrid({ role }: { role: string | null | undefined }) {
  const tiles = getQuickAccessTiles(role);
  if (tiles.length === 0) return null;

  return (
    <div className="pb-6">
      <h2 className={cn(TYPO_CARD_TITLE, "mb-3")}>Quick Access</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {tiles.map((tile) => (
          <QuickAccessTileLink key={tile.path + tile.label} {...tile} />
        ))}
      </div>
    </div>
  );
}
