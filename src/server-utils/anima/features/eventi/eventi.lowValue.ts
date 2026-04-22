import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectGreeting(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  const stripped = ANIMA_RUNTIME_CONFIG.routing.greetingTerms.find(
    (term) => normalized === term,
  );
  if (stripped) return true;

  const greetingPrefix = ANIMA_RUNTIME_CONFIG.routing.greetingTerms.find(
    (term) => normalized.startsWith(`${term} `),
  );
  if (!greetingPrefix) return false;

  const tail = normalized.slice(greetingPrefix.length).trim();
  if (!tail) return true;

  const intentSignals = [
    "cerca",
    "cercami",
    "cercar",
    "mostra",
    "mostrami",
    "dimmi",
    "elenca",
    "vedi",
    "vedere",
    "voglio",
    "vorrei",
    "puoi",
    "mi dici",
    "mi mostri",
    "event",
    "task",
    "compit",
    "anagrafic",
    "mail",
    "email",
    "scadenz",
    "arrivo",
    "merce",
  ];

  return !intentSignals.some((signal) => tail.includes(signal));
}

export function detectLowValuePrompt(message: string): {
  matched: boolean;
  reason?: string;
} {
  const normalized = normalizeText(message);
  if (!normalized) {
    return { matched: true, reason: "empty" };
  }

  const greetings = ANIMA_RUNTIME_CONFIG.routing.greetingTerms;
  const tinyPrompts = ["?", "ok", "boh", "mah", "test"];

  if (greetings.includes(normalized)) {
    return { matched: true, reason: "greeting" };
  }

  if (tinyPrompts.includes(normalized)) {
    return { matched: true, reason: "too_short" };
  }

  if (normalized.length <= 3) {
    return { matched: true, reason: "very_short" };
  }

  return { matched: false };
}

export function buildLowValueReply(displayName?: string | null): string {
  const prefix = displayName ? `Ciao ${displayName}.` : "Ciao.";
  const capabilities = ANIMA_RUNTIME_CONFIG.texts.fallbackCapabilities.map(
    (item, index) => `${index + 1}. ${item}`,
  );

  return [
    prefix,
    "Posso fare soprattutto tre cose utili senza sprecare token:",
    ...capabilities,
  ].join("\n");
}
