/**
 * groqClient.ts
 * -------------
 * Implementa il provider LLM concreto: Groq.
 * Espone una funzione createGroqProvider(apiKey) che ti dà un oggetto LlmProvider.
 */

import type { LlmProvider } from "./types";

/**
 * Crea un provider Groq che implementa l'interfaccia LlmProvider.
 * - Non salva API key nel ctx (mai)
 * - La key resta "fuori", in configurazione server-side
 */
export function createGroqProvider(apiKey: string): LlmProvider {
  if (!apiKey) {
    throw new Error("GROQ_API_KEY_MISSING");
  }

  return {
    kind: "groq",
    /**
     * chat(...)
     * --------
     * Fa una chiamata a Groq compatibile OpenAI Chat Completions.
     * Torna direttamente la stringa content dell'assistente.
     */
    async chat({ model, temperature, messages }) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature,
          messages,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`GROQ_ERROR_${res.status}: ${t || "request failed"}`);
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
