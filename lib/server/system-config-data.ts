/**
 * Server-side system config fetch for admin settings SSR.
 * Mirrors GET /api/system-config shape (configs + category labels).
 */

import { getCache, setCache } from "@/lib/cache";
import {
  getAllSystemConfigs,
  getConfigValue,
  initializeDefaultConfigs,
} from "@/prisma/system-config";
import { CATEGORY_LABELS, DEFAULT_CONFIGS } from "@/types";
import type { SystemConfig } from "@/types";
import { logger } from "@/lib/logger";

const CACHE_KEY = "system-config:all";
const THEME_PRIMARY_CACHE_KEY = "system-config:theme-primary-color";
const THEME_PRIMARY_FALLBACK =
  DEFAULT_CONFIGS.find((c) => c.key === "theme_primary_color")?.value ??
  "0 72.2% 50.6%";

function transform(
  config: Awaited<ReturnType<typeof getAllSystemConfigs>>[number],
): SystemConfig {
  return {
    id: config.id,
    key: config.key,
    value: config.value,
    type: config.type as SystemConfig["type"],
    label: config.label,
    description: config.description,
    category: config.category as SystemConfig["category"],
    isPublic: config.isPublic,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt?.toISOString() ?? null,
    updatedBy: config.updatedBy,
  };
}

export type SystemConfigForPage = {
  configs: SystemConfig[];
  categories: Record<string, string>;
};

/** Fetch all system configs for admin settings page (Redis-cached). */
export async function getSystemConfigForAdmin(): Promise<SystemConfigForPage> {
  const cacheReadStartedAt = Date.now();
  const cached = await getCache<SystemConfig[]>(CACHE_KEY);
  if (cached) {
    return { configs: cached, categories: CATEGORY_LABELS };
  }

  await initializeDefaultConfigs();
  const configs = (await getAllSystemConfigs()).map(transform);
  await setCache(CACHE_KEY, configs, 300, { fetchedAt: cacheReadStartedAt });

  return { configs, categories: CATEGORY_LABELS };
}

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
