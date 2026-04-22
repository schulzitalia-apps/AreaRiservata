import type { ChatProvider } from "../types";

export function createGroqChatProvider(args: {
  apiKey: string;
  baseUrl?: string;
}): ChatProvider {
  if (!args.apiKey) {
    throw new Error("GROQ_API_KEY_MISSING");
  }

  return {
    kind: "groq",
    async chat({ model, temperature, messages }) {
      const res = await fetch(
        args.baseUrl ?? "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${args.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature,
            messages,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GROQ_ERROR_${res.status}: ${text || "request failed"}`);
      }

      const data: any = await res.json();
      return {
        content: String(data?.choices?.[0]?.message?.content ?? "").trim(),
        usage: {
          inputTokens:
            typeof data?.usage?.prompt_tokens === "number"
              ? data.usage.prompt_tokens
              : null,
          outputTokens:
            typeof data?.usage?.completion_tokens === "number"
              ? data.usage.completion_tokens
              : null,
          totalTokens:
            typeof data?.usage?.total_tokens === "number"
              ? data.usage.total_tokens
              : null,
        },
      };
    },
  };
}
