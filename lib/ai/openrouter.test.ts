import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOpenRouterChatCompletion } from "./openrouter";

describe("createOpenRouterChatCompletion", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.GROQ_API_KEY;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps HTTP 402 to billing failure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("insufficient credits", { status: 402 }),
    );

    const result = await createOpenRouterChatCompletion([
      { role: "user", content: "hi" },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("billing");
      expect(result.status).toBe(402);
    }
  });

  it("returns data on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "1",
          choices: [
            {
              message: { role: "assistant", content: "ok" },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await createOpenRouterChatCompletion([
      { role: "user", content: "hi" },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.choices[0]?.message.content).toBe("ok");
      expect(result.provider).toBe("openrouter");
    }
  });
});
