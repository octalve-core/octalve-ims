/**
 * Server-side system config fetch — Core tier variant.
 *
 * getThemePrimaryColor runs on every page request (app/layout.tsx, every
 * tier) for SSR theme-color injection, so it must stay working in Core.
 * getSystemConfigForAdmin backs only the Pro-gated admin settings edit page
 * (components/admin/AdminSettingsContent.core.tsx doesn't render it) and is
 * dropped here along with its SystemConfig/CATEGORY_LABELS type dependency.
 */

import { getCache, setCache } from "@/lib/cache";
import { getConfigValue } from "@/prisma/system-config";
import { logger } from "@/lib/logger";

const THEME_PRIMARY_CACHE_KEY = "system-config:theme-primary-color";
const THEME_PRIMARY_FALLBACK = "0 72.2% 50.6%";

export type SystemConfigForPage = {
  configs: never[];
  categories: Record<string, string>;
};

/**
 * Theme primary-color HSL triplet for root-layout SSR style injection
 * (app/layout.tsx). Runs on every page request, so this must never throw —
 * any failure (DB down, cache down, row missing) falls back to the same
 * default baked into globals.css, meaning the app degrades to today's fixed
 * palette rather than breaking the page render.
 */
export async function getThemePrimaryColor(): Promise<string> {
  try {
    const cached = await getCache<string>(THEME_PRIMARY_CACHE_KEY);
    if (cached) return cached;

    const value = await getConfigValue<string>(
      "theme_primary_color",
      THEME_PRIMARY_FALLBACK,
    );
    await setCache(THEME_PRIMARY_CACHE_KEY, value, 300);
    return value;
  } catch (error) {
    logger.warn("getThemePrimaryColor: falling back to default", { error });
    return THEME_PRIMARY_FALLBACK;
  }
}
