/**
 * System configuration API validation schemas
 */

import { z } from "zod";

const systemConfigEntrySchema = z.object({
  key: z.string().min(1, "Configuration key is required"),
  value: z.string(),
});

export const updateSystemConfigsBodySchema = z.object({
  configs: z
    .array(systemConfigEntrySchema)
    .min(1, "At least one configuration is required"),
});

export type UpdateSystemConfigsBody = z.infer<
  typeof updateSystemConfigsBodySchema
>;
