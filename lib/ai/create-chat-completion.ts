/**
 * LLM orchestrator: OpenRouter first, Groq fallback on failure.
 * Used by /api/ai/insights and forecasting AI helpers.
 */

import { createGroqChatCompletion, isGroqConfigured } from "./groq";
import {
  createOpenRouterChatCompletion,
  isOpenRouterConfigured,
} from "./openrouter";
import type {
  ChatCompletionFailureKind,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
} from "./types";

export type {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatCompletionFailureKind,
  ChatCompletionResult,
  LlmProvider,
} from "./types";

/** Re-export for callers that only check OpenRouter */
export { isOpenRouterConfigured } from "./openrouter";
export { isGroqConfigured } from "./groq";

/** True when at least one provider has an API key */
export function isLlmConfigured(): boolean {
  return isOpenRouterConfigured() || isGroqConfigured();
}

const FALLBACK_KINDS: ChatCompletionFailureKind[] = [
  "billing",
  "rate_limit",
  "upstream",
  "not_configured",
];

function shouldTryGroqFallback(
  openRouterResult: Extract<ChatCompletionResult, { ok: false }>,
): boolean {
  if (!isGroqConfigured()) {
    return false;
  }
  return FALLBACK_KINDS.includes(openRouterResult.kind);
}

/**
 * Try OpenRouter; on billing/rate-limit/upstream/not_configured, try Groq.
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<ChatCompletionResult> {
  const openRouterResult = await createOpenRouterChatCompletion(
    messages,
    options,
  );

  if (openRouterResult.ok) {
    return openRouterResult;
  }

  if (shouldTryGroqFallback(openRouterResult)) {
    console.warn(
      "[LLM] OpenRouter failed, trying Groq fallback:",
      openRouterResult.kind,
    );
    const groqResult = await createGroqChatCompletion(messages, options);
    if (groqResult.ok) {
      return groqResult;
    }
    return groqResult;
  }

  return openRouterResult;
}
