import { LLM_RUNTIME_CONFIG, resolveChatProviderKind, resolveDefaultChatModel } from "./llm.runtime.config";
import { createGlmChatProvider } from "./providers/glmChatProvider";
import { createGroqChatProvider } from "./providers/groqChatProvider";
import type { ChatMessage, ChatOptions, ChatProvider, ChatProviderKind } from "./types";

export type { ChatMessage, ChatOptions, ChatProvider, ChatProviderKind } from "./types";
export { LLM_RUNTIME_CONFIG, resolveDefaultChatModel };

export function createRuntimeChatProvider(
  providerOverride?: ChatProviderKind | null
): ChatProvider {
  const provider = resolveChatProviderKind(providerOverride);

  if (provider === "glm") {
    return createGlmChatProvider({
      apiKey: LLM_RUNTIME_CONFIG.chat.glm.apiKey,
      baseUrl: LLM_RUNTIME_CONFIG.chat.glm.baseUrl,
      enableThinking: LLM_RUNTIME_CONFIG.chat.glm.enableThinking,
    });
  }

  return createGroqChatProvider({
    apiKey: LLM_RUNTIME_CONFIG.chat.groq.apiKey,
    baseUrl: LLM_RUNTIME_CONFIG.chat.groq.baseUrl,
  });
}

export function resolveRuntimeChatSelection(args?: {
  provider?: ChatProviderKind | null;
  model?: string | null;
}) {
  const provider = resolveChatProviderKind(args?.provider);
  return {
    provider,
    model: args?.model?.trim() || resolveDefaultChatModel(provider),
  };
}

type ProviderVariants = Partial<
  Record<ChatProviderKind, { model: string | null }>
>;

const MODEL_COOLDOWNS = new Map<string, number>();

function getAttemptKey(provider: ChatProviderKind, model: string) {
  return `${provider}:${model}`;
}

function isRateLimitError(error: unknown) {
  const message = String((error as any)?.message ?? error ?? "");
  return (
    message.includes("ERROR_429") ||
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("rate_limit")
  );
}

function parseRateLimitCooldownMs(error: unknown) {
  const message = String((error as any)?.message ?? error ?? "");

  const hoursMinutesSeconds = message.match(
    /try again in\s+(\d+)h(\d+)m([\d.]+)s/i,
  );
  if (hoursMinutesSeconds) {
    return (
      Number(hoursMinutesSeconds[1]) * 3600000 +
      Number(hoursMinutesSeconds[2]) * 60000 +
      Number(hoursMinutesSeconds[3]) * 1000
    );
  }

  const minutesSeconds = message.match(/try again in\s+(\d+)m([\d.]+)s/i);
  if (minutesSeconds) {
    return (
      Number(minutesSeconds[1]) * 60000 +
      Number(minutesSeconds[2]) * 1000
    );
  }

  const secondsOnly = message.match(/try again in\s+([\d.]+)s/i);
  if (secondsOnly) {
    return Number(secondsOnly[1]) * 1000;
  }

  return 30000;
}

function isAttemptCoolingDown(provider: ChatProviderKind, model: string) {
  const key = getAttemptKey(provider, model);
  const cooldownUntil = MODEL_COOLDOWNS.get(key);
  if (!cooldownUntil) return false;
  if (cooldownUntil <= Date.now()) {
    MODEL_COOLDOWNS.delete(key);
    return false;
  }
  return true;
}

function markAttemptCoolingDown(
  provider: ChatProviderKind,
  model: string,
  error: unknown,
) {
  const cooldownMs = Math.max(1000, parseRateLimitCooldownMs(error));
  MODEL_COOLDOWNS.set(getAttemptKey(provider, model), Date.now() + cooldownMs);
}

function buildAttemptOrder(args: {
  provider?: ChatProviderKind | null;
  model?: string | null;
  variants?: ProviderVariants | null;
}) {
  const primaryProvider = resolveChatProviderKind(args.provider);
  const secondaryProvider: ChatProviderKind =
    primaryProvider === "groq" ? "glm" : "groq";
  const attempts: Array<{ provider: ChatProviderKind; model: string }> = [];
  const seen = new Set<string>();

  const providerEnabled = (provider: ChatProviderKind) => {
    if (provider === "groq") {
      return !!LLM_RUNTIME_CONFIG.chat.groq.apiKey;
    }
    return !!LLM_RUNTIME_CONFIG.chat.glm.apiKey;
  };

  const pushAttempt = (provider: ChatProviderKind, model?: string | null) => {
    if (!providerEnabled(provider)) return;
    const trimmed = String(model ?? "").trim();
    if (!trimmed) return;
    const key = `${provider}:${trimmed}`;
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({ provider, model: trimmed });
  };

  pushAttempt(primaryProvider, args.model);
  pushAttempt(primaryProvider, args.variants?.[primaryProvider]?.model ?? null);
  pushAttempt(
    secondaryProvider,
    args.variants?.[secondaryProvider]?.model ?? null,
  );
  pushAttempt(primaryProvider, resolveDefaultChatModel(primaryProvider));
  pushAttempt(secondaryProvider, resolveDefaultChatModel(secondaryProvider));

  const availableAttempts = attempts.filter(
    (attempt) => !isAttemptCoolingDown(attempt.provider, attempt.model),
  );

  if (availableAttempts.length > 0) {
    return availableAttempts;
  }

  if (attempts.length <= 1) {
    return attempts;
  }

  return [attempts[0]];
}

export async function chatWithRuntimeFailover(args: {
  provider?: ChatProviderKind | null;
  model?: string | null;
  variants?: ProviderVariants | null;
  temperature?: number;
  messages: ChatMessage[];
}) {
  const attempts = buildAttemptOrder(args);
  let lastError: unknown = null;

  for (let index = 0; index < attempts.length; index++) {
    const attempt = attempts[index];
    try {
      const provider = createRuntimeChatProvider(attempt.provider);
      const result = await provider.chat({
        model: attempt.model,
        temperature: args.temperature,
        messages: args.messages,
      } satisfies ChatOptions);

      return {
        raw: result.content,
        usage: result.usage ?? null,
        provider: attempt.provider,
        model: attempt.model,
        usedFallback: index > 0,
      };
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error)) {
        markAttemptCoolingDown(attempt.provider, attempt.model, error);
      }
      if (!isRateLimitError(error) || index === attempts.length - 1) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("CHAT_FAILOVER_FAILED");
}
