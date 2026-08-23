/**
 * OpenRouter API client
 * Use OpenAI-compatible models via OpenRouter.
 * Base URL: https://openrouter.ai/api/v1
 */

import type {
  ChatCompletionOptions,
  ChatCompletionFailureKind,
  ChatCompletionResponse,
  ChatCompletionResult,
  ChatMessage,
} from "./types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** @deprecated Use ChatMessage from ./types */
export type OpenRouterMessage = ChatMessage;

/** @deprecated Use ChatCompletionOptions from ./types */
export type OpenRouterChatOptions = ChatCompletionOptions;

/** @deprecated Use ChatCompletionResponse from ./types */
export type OpenRouterChatResponse = ChatCompletionResponse;

/** @deprecated Use ChatCompletionFailureKind from ./types */
export type OpenRouterFailureKind = ChatCompletionFailureKind;

/** @deprecated Use ChatCompletionResult from ./types */
export type OpenRouterResult = ChatCompletionResult;

export function isOpenRouterConfigured(): boolean {
  const key = process.env.OPENROUTER_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

function mapHttpStatusToKind(status: number): ChatCompletionFailureKind {
  if (status === 402) {
    return "billing";
  }
  if (status === 429) {
    return "rate_limit";
  }
  return "upstream";
}

/**
 * Create a chat completion via OpenRouter only (no Groq fallback).
 */
export async function createOpenRouterChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<ChatCompletionResult> {
  if (!isOpenRouterConfigured()) {
    return { ok: false, kind: "not_configured", provider: "openrouter" };
  }

  const apiKey = process.env.OPENROUTER_API_KEY!;
  const model = options.model ?? "openai/gpt-4o-mini";

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.max_tokens ?? 1024,
        temperature: options.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      const kind = mapHttpStatusToKind(response.status);
      console.error("[OpenRouter] API error:", response.status, text);
      return {
        ok: false,
        kind,
        provider: "openrouter",
        status: response.status,
        message: text.slice(0, 500),
      };
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return { ok: true, data, provider: "openrouter" };
  } catch (error) {
    console.error("[OpenRouter] Request failed:", error);
    return {
      ok: false,
      kind: "upstream",
      provider: "openrouter",
      message: error instanceof Error ? error.message : "Request failed",
    };
  }
}
