/**
 * AI API validation schemas
 */

import { z } from "zod";

export const aiInsightsBodySchema = z.object({
  summary: z.string().trim().min(1, "Summary is required"),
});

export type AiInsightsBody = z.infer<typeof aiInsightsBodySchema>;
