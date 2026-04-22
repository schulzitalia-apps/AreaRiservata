import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import type { AnimaSessionInput } from "@/server-utils/anima/core/types";

export type TelegramAdapterInput = {
  telegramUserId: string;
  chatId: string;
  text: string;
  language?: "it" | "en";
  displayName?: string | null;
  username?: string | null;
  phone?: string | null;
};

export function buildTelegramSessionId(args: {
  telegramUserId: string;
  chatId: string;
}): string {
  return `telegram:${args.telegramUserId}:${args.chatId}`;
}

export function toAnimaTelegramInput(
  input: TelegramAdapterInput,
): AnimaSessionInput {
  return {
    userId: input.telegramUserId,
    sessionId: buildTelegramSessionId({
      telegramUserId: input.telegramUserId,
      chatId: input.chatId,
    }),
    message: input.text,
    channel: "telegram",
    language: input.language ?? "it",
    user: {
      userId: input.telegramUserId,
      displayName: input.displayName ?? input.username ?? null,
      phone: input.phone ?? null,
      isAuthenticated: false,
    },
  };
}

export const TELEGRAM_ADAPTER_NOTES = {
  enabled: ANIMA_RUNTIME_CONFIG.channels.telegram.enabled,
  identityMode: ANIMA_RUNTIME_CONFIG.channels.telegram.identityMode,
  phoneIsNotGuaranteed:
    ANIMA_RUNTIME_CONFIG.channels.telegram.phoneIsNotGuaranteed,
  webhookStrategy: ANIMA_RUNTIME_CONFIG.channels.telegram.webhookStrategy,
  notes: [
    "Usare user id e chat id come chiave di sessione, non il numero di telefono.",
    "Il numero di telefono va considerato opzionale anche se l'utente lo condivide in chat.",
    "Questo file e solo un adapter placeholder: il webhook Telegram andra estratto in una fase successiva.",
  ],
} as const;
