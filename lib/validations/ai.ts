/**
 * AI API validation schemas
 */

import { z } from "zod";

// ISS-0054: unbounded before this — any caller could send an arbitrarily
// large body straight through to a third-party LLM.
export const aiInsightsBodySchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1, "Summary is required")
    .max(2000, "Summary must be 2000 characters or fewer"),
});

export type AiInsightsBody = z.infer<typeof aiInsightsBodySchema>;
