import type { ChatProvider } from "../types";

export function createGlmChatProvider(args: {
  apiKey: string;
  baseUrl: string;
  enableThinking?: boolean;
}): ChatProvider {
  if (!args.apiKey) {
    throw new Error("GLM_API_KEY_MISSING");
  }

  return {
    kind: "glm",
    async chat({ model, temperature, messages }) {
      const body: Record<string, any> = {
        model,
        temperature,
        messages,
      };

      if (args.enableThinking) {
        body.thinking = { type: "enabled" };
      }

      const res = await fetch(args.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GLM_ERROR_${res.status}: ${text || "request failed"}`);
      }

      const data: any = await res.json();
      return {
        content: String(data?.choices?.[0]?.message?.content ?? "").trim(),
        usage: {
          inputTokens:
            typeof data?.usage?.prompt_tokens === "number"
              ? data.usage.prompt_tokens
              : typeof data?.usage?.input_tokens === "number"
                ? data.usage.input_tokens
                : null,
          outputTokens:
            typeof data?.usage?.completion_tokens === "number"
              ? data.usage.completion_tokens
              : typeof data?.usage?.output_tokens === "number"
                ? data.usage.output_tokens
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
