/**
 * System configuration API validation schemas
 */

import { z } from "zod";
import { isHslTriplet } from "@/lib/ui/color-convert";

/** Config keys whose value must be an "H S% L%" HSL triplet (see globals.css --primary etc). */
const HSL_TRIPLET_KEYS = new Set(["theme_primary_color"]);

const systemConfigEntrySchema = z
  .object({
    key: z.string().min(1, "Configuration key is required"),
    value: z.string(),
  })
  .refine(
    (entry) => !HSL_TRIPLET_KEYS.has(entry.key) || isHslTriplet(entry.value),
    (entry) => ({
      message: `${entry.key} must be an HSL triplet like "217 91% 60%"`,
      path: ["value"],
    }),
  );

export const updateSystemConfigsBodySchema = z.object({
  configs: z
    .array(systemConfigEntrySchema)
    .min(1, "At least one configuration is required"),
});

export type UpdateSystemConfigsBody = z.infer<
  typeof updateSystemConfigsBodySchema
>;
