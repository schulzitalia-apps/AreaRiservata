import type { ChatProviderKind } from "./types";

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === "") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeProvider(value: string | undefined): ChatProviderKind {
  const normalized = value?.trim().toLowerCase();
  return normalized === "glm" ? "glm" : "groq";
}

export const LLM_RUNTIME_CONFIG = {
  chat: {
    provider: normalizeProvider(process.env.ANIMA_LLM_PROVIDER ?? process.env.LLM_PROVIDER),
    groq: {
      apiKey: process.env.GROQ_API_KEY ?? "",
      model:
        process.env.GROQ_MODEL ??
        process.env.ANIMA_GROQ_SAFE_MODEL ??
        "meta-llama/llama-4-scout-17b-16e-instruct",
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    },
    glm: {
      apiKey: process.env.GLM_API_KEY ?? "",
      model: process.env.GLM_MODEL ?? "glm-4.7",
      baseUrl:
        process.env.GLM_BASE_URL ??
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      enableThinking: parseBooleanEnv(process.env.GLM_ENABLE_THINKING, true),
    },
  },
} as const;

export function resolveChatProviderKind(
  providerOverride?: ChatProviderKind | null
): ChatProviderKind {
  return providerOverride ?? LLM_RUNTIME_CONFIG.chat.provider;
}

export function resolveDefaultChatModel(
  providerOverride?: ChatProviderKind | null
) {
  const provider = resolveChatProviderKind(providerOverride);
  return provider === "glm"
    ? LLM_RUNTIME_CONFIG.chat.glm.model
    : LLM_RUNTIME_CONFIG.chat.groq.model;
}
