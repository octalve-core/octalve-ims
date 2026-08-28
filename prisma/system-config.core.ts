/**
 * System Configuration Prisma helpers — Core tier variant.
 *
 * Keeps the read path (getConfigValue backs app/layout.tsx's Core-tier
 * theme-color SSR injection). Drops updateSystemConfig(s) and
 * initializeDefaultConfigs — write/seed operations that only the Pro-gated
 * admin settings page (components/admin/SystemConfigSettings.tsx) uses,
 * along with their UpdateSystemConfigInput/DEFAULT_CONFIGS dependency.
 */

import { prisma } from "@/prisma/client";

/**
 * Get all system configurations
 */
export async function getAllSystemConfigs() {
  return prisma.systemConfig.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
}

/**
 * Get public system configurations only
 */
export async function getPublicSystemConfigs() {
  return prisma.systemConfig.findMany({
    where: { isPublic: true },
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
}

/**
 * Get system configuration by key
 */
export async function getSystemConfigByKey(key: string) {
  return prisma.systemConfig.findUnique({
    where: { key },
  });
}

/**
 * Get system configuration value by key (returns typed value)
 */
export async function getConfigValue<T = string>(
  key: string,
  defaultValue?: T,
): Promise<T> {
  const config = await getSystemConfigByKey(key);
  if (!config) {
    return defaultValue as T;
  }

  // Parse value based on type
  switch (config.type) {
    case "number":
      return parseFloat(config.value) as T;
    case "boolean":
      return (config.value === "true") as T;
    case "json":
      try {
        return JSON.parse(config.value) as T;
      } catch {
        return defaultValue as T;
      }
    default:
      return config.value as T;
  }
}
