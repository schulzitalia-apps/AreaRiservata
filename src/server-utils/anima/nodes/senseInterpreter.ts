import { chatWithRuntimeFailover } from "@/server-utils/llm";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.config";
import type { PendingOperationState } from "@/server-utils/anima/memory/sessionState";
import type {
  AnimaLlmTraceStep,
  AnimaRecentTurn,
} from "@/server-utils/anima/core/types";
import type { AnimaRegistryAwareness } from "@/server-utils/anima/core/registryAwareness";
import { buildRegistryAwareness } from "@/server-utils/anima/core/registryAwareness";

export type SenseInterpretation = {
  route:
    | "welcome"
    | "event_operation"
    | "mail_operation"
    | "active_operation"
    | "emotional"
    | "guardrail";
  operationDecision: "open_new" | "continue_open" | "none";
  likelyCapability:
    | "event_create"
    | "event_list"
    | "event_recent"
    | "sprint_timeline_read"
    | "anagrafiche_read"
    | "anagrafiche_create"
    | "generic_mail"
    | "mail_followup"
    | "help"
    | "unknown";
  normalizedMessage: string;
  responseMode: "functional" | "extended";
  guardrailColor: "green" | "orange" | "red";
  confidence: number;
  why: string[];
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeExplicitAnagraficheTaskRequest(normalizedMessage: string) {
  return (
    normalizedMessage.includes("anagrafic") ||
    normalizedMessage.includes("scheda task") ||
    normalizedMessage.includes("record task") ||
    normalizedMessage.includes("campi task") ||
    normalizedMessage.includes("anagrafica task")
  );
}

function looksLikeSprintTimelineTaskRequest(normalizedMessage: string) {
  if (looksLikeExplicitAnagraficheTaskRequest(normalizedMessage)) return false;

  const managerSignals = [
    "chi sta facendo cosa",
    "chi fa cosa",
    "chi segue cosa",
    "chi sta seguendo",
    "siamo in ritardo",
    "cosa e in ritardo",
    "cosa è in ritardo",
    "cosa sta slittando",
    "cosa e a rischio",
    "cosa è a rischio",
    "quanti passaggi",
    "quanti checkpoint",
    "da quanti passaggi",
    "come e composto",
    "come è composto",
  ];
  if (managerSignals.some((token) => normalizedMessage.includes(token))) {
    return true;
  }

  const taskLexicon = [
    "task",
    "attivita",
    "compiti",
    "compito",
    "todo",
    "to do",
    "to-do",
    "da fare",
    "cose da fare",
    "cosa c e da fare",
    "cosa c'e da fare",
  ];
  const hasTaskWord = taskLexicon.some((token) =>
    normalizedMessage.includes(token),
  );
  if (!hasTaskWord) return false;

  const timelineSignals = [
    "miei task",
    "mie task",
    "mie attivita",
    "miei compiti",
    "i miei compiti",
    "i miei todo",
    "le cose da fare",
    "ho da fare",
    "cosa devo fare",
    "cosa ho da fare",
    "cose da fare",
    "cosa c e da fare",
    "da fare",
    "task attivi",
    "task futuri",
    "task aperti",
    "compiti attivi",
    "compiti futuri",
    "compiti aperti",
    "task dei prossimi",
    "prossimi task",
    "prossimi compiti",
    "prossimi giorni",
    "oggi",
    "domani",
    "scadenz",
    "priorita",
    "tutti i task",
    "tutti i compiti",
    "tutte le attivita",
    "todo",
  ];

  return timelineSignals.some((signal) => normalizedMessage.includes(signal));
}

function hasEventListLeadIn(normalizedMessage: string) {
  return [
    "cerca",
    "cercami",
    "cercar",
    "mostra",
    "mostrami",
    "fammi vedere",
    "vedi",
    "vedere",
    "elenca",
    "lista",
    "dammi",
    "mi dici",
    "puoi indicarmi",
    "puoi cercarmi",
    "vorrei cercare",
  ].some((token) => normalizedMessage.includes(token));
}

function hasEventCreateLeadIn(normalizedMessage: string) {
  return [
    "crea",
    "aggiungi",
    "fissa",
    "programma",
    "inserisci",
    "ricordami",
    "ricordamelo",
    "mi ricordi",
    "nuovo evento",
    "nuovo memo",
    "nuovo appuntamento",
  ].some((token) => normalizedMessage.includes(token));
}

function forceEventListInterpretation(
  interpretation: SenseInterpretation,
  message: string,
): SenseInterpretation {
  const normalizedMessage = normalizeText(message);
  const mentionsEventDomain =
    normalizedMessage.includes("event") ||
    normalizedMessage.includes("appuntament") ||
    normalizedMessage.includes("calendario") ||
    normalizedMessage.includes("riunione") ||
    normalizedMessage.includes("memo") ||
    normalizedMessage.includes("arrivo") ||
    normalizedMessage.includes("merce") ||
    normalizedMessage.includes("pagamento") ||
    normalizedMessage.includes("fattura");

  if (
    mentionsEventDomain &&
    hasEventListLeadIn(normalizedMessage) &&
    !hasEventCreateLeadIn(normalizedMessage)
  ) {
    return {
      ...interpretation,
      route: "event_operation",
      operationDecision: "open_new",
      likelyCapability: "event_list",
      normalizedMessage: message,
      guardrailColor: "green",
      confidence: Math.max(interpretation.confidence, 0.82),
      why: [
        "richiesta formulata come ricerca o consultazione eventi",
        "presente dominio eventi senza segnali di creazione",
      ],
    };
  }

  return interpretation;
}

function forceSprintTimelineInterpretation(
  interpretation: SenseInterpretation,
  message: string,
  operationState?: PendingOperationState | null,
): SenseInterpretation {
  const normalizedMessage = normalizeText(message);
  const pendingTaskAnagrafica =
    operationState?.operation === "anagrafiche_read" &&
    (operationState as any)?.data?.typeSlug === "task";
  const pendingSprintTimeline =
    operationState?.operation === "sprint_timeline_read";

  if (
    looksLikeSprintTimelineTaskRequest(normalizedMessage) ||
    pendingTaskAnagrafica
  ) {
    return {
      ...interpretation,
      route: "active_operation",
      operationDecision: pendingTaskAnagrafica
        ? "open_new"
        : pendingSprintTimeline
          ? "continue_open"
          : "open_new",
      likelyCapability: "sprint_timeline_read",
      normalizedMessage: message,
      guardrailColor: "green",
      confidence: Math.max(interpretation.confidence, 0.78),
      why: [
        "richiesta compatibile con task della sprint timeline",
        ...(pendingTaskAnagrafica
          ? ["pending anagrafica task riallineato al dominio timeline"]
          : []),
      ].slice(0, 2),
    };
  }

  return interpretation;
}

function extractFirstJsonObject(text: string): string | null {
  const s = text.trim();
  const start = s.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

function normalizeCapabilityAlias(value: unknown): SenseInterpretation["likelyCapability"] {
  const raw = String(value ?? "").trim().toLowerCase();

  if (
    raw === "event_create" ||
    raw === "event_list" ||
    raw === "event_recent" ||
    raw === "sprint_timeline_read" ||
    raw === "anagrafiche_read" ||
    raw === "anagrafiche_create" ||
    raw === "generic_mail" ||
    raw === "mail_followup" ||
    raw === "help"
  ) {
    return raw;
  }

  if (
    raw.includes("anagrafic") ||
    raw.endsWith("_read") ||
    raw.endsWith("_list") ||
    raw.includes("client") ||
    raw.includes("fornitor") ||
    raw.includes("ent") ||
    raw.includes("preventiv") ||
    raw.includes("ricav")
  ) {
    return "anagrafiche_read";
  }

  if (raw.includes("create") && raw.includes("anagraf")) {
    return "anagrafiche_create";
  }

  if (
    raw.includes("sprint") ||
    raw.includes("timeline") ||
    raw.includes("taskboard") ||
    raw === "task_read"
  ) {
    return "sprint_timeline_read";
  }

  if (raw.includes("mail")) {
    return raw.includes("follow") ? "mail_followup" : "generic_mail";
  }

  if (raw.includes("recent")) return "event_recent";
  if (raw.includes("list") || raw.includes("search") || raw.includes("evento")) {
    return "event_list";
  }
  if (raw.includes("create") || raw.includes("nuovo")) {
    return "event_create";
  }

  return "unknown";
}

function normalizeInterpretation(raw: any, fallbackMessage: string): SenseInterpretation {
  const normalizedCapability = normalizeCapabilityAlias(raw?.likelyCapability);

  const route =
    raw?.route === "welcome" ||
    raw?.route === "event_operation" ||
    raw?.route === "mail_operation" ||
    raw?.route === "active_operation" ||
    raw?.route === "emotional" ||
    raw?.route === "guardrail"
      ? raw.route
      : normalizedCapability === "generic_mail" ||
          normalizedCapability === "mail_followup"
        ? "mail_operation"
        : normalizedCapability === "event_create" ||
            normalizedCapability === "event_list" ||
            normalizedCapability === "event_recent"
          ? "event_operation"
          : normalizedCapability === "anagrafiche_read" ||
              normalizedCapability === "anagrafiche_create" ||
              normalizedCapability === "sprint_timeline_read"
            ? "active_operation"
      : "guardrail";

  const operationDecision =
    raw?.operationDecision === "open_new" ||
    raw?.operationDecision === "continue_open" ||
    raw?.operationDecision === "none"
      ? raw.operationDecision
      : "none";

  const likelyCapability = normalizedCapability;

  const responseMode =
    raw?.responseMode === "extended" ? "extended" : "functional";
  const guardrailColor =
    raw?.guardrailColor === "green" ||
    raw?.guardrailColor === "orange" ||
    raw?.guardrailColor === "red"
      ? raw.guardrailColor
      : "red";

  const confidenceNumber = Number(raw?.confidence);
  const confidence = Number.isFinite(confidenceNumber)
    ? Math.max(0, Math.min(1, confidenceNumber))
    : 0.25;

  const why = Array.isArray(raw?.why)
    ? raw.why.map((item: unknown) => String(item)).filter(Boolean).slice(0, 5)
    : [];

  return {
    route,
    operationDecision,
    likelyCapability,
    normalizedMessage:
      typeof raw?.normalizedMessage === "string" && raw.normalizedMessage.trim()
        ? raw.normalizedMessage.trim()
        : fallbackMessage,
    responseMode,
    guardrailColor,
    confidence,
    why,
  };
}

export async function runSenseInterpreter(args: {
  message: string;
  language: "it" | "en";
  userDisplayName?: string | null;
  conversationSummary?: string | null;
  recentTurns?: AnimaRecentTurn[];
  operationState?: PendingOperationState | null;
  registryAwareness?: AnimaRegistryAwareness | null;
  hasWelcomed?: boolean;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<SenseInterpretation | null> {
  if (!ANIMA_RUNTIME_CONFIG.targetRuntime.enabled) {
    return null;
  }

  const modelConfig = ANIMA_RUNTIME_CONFIG.targetRuntime.models.senseInterpreter;
  if (modelConfig.mode !== "llm" || !modelConfig.model) {
    return null;
  }

  const systemPrompt =
    ANIMA_PROMPTS_CONFIG.nodes.senseInterpreter.buildSystemPrompt();

  const payload = {
    message: args.message,
    language: args.language,
    userDisplayName: args.userDisplayName ?? null,
    recentTurns: args.recentTurns ?? [],
    conversationSummary: args.conversationSummary ?? "",
    hasWelcomed: !!args.hasWelcomed,
    operationState: args.operationState ?? null,
    registryAwareness: args.registryAwareness ?? buildRegistryAwareness(),
  };

  try {
    const completion = await chatWithRuntimeFailover({
      provider: modelConfig.provider,
      model: modelConfig.model,
      variants: modelConfig.variants,
      temperature: ANIMA_PROMPTS_CONFIG.nodes.senseInterpreter.temperature,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.raw;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr);
    const normalized = forceSprintTimelineInterpretation(
      forceEventListInterpretation(
        normalizeInterpretation(parsed, args.message),
        args.message,
      ),
      args.message,
      args.operationState,
    );
    args.traceCollector?.({
      id: `sense-${Date.now()}`,
      step: "senseInterpreter",
      title: "Sense Interpreter",
      reason: "Interpretare il turno e decidere la corsia semantica iniziale.",
      provider: completion.provider,
      model: completion.model,
      usage: completion.usage,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: raw,
      parsedResponse: normalized,
      status: "success",
      error: null,
    });
    return normalized;
  } catch (error: any) {
    args.traceCollector?.({
      id: `sense-${Date.now()}`,
      step: "senseInterpreter",
      title: "Sense Interpreter",
      reason: "Interpretare il turno e decidere la corsia semantica iniziale.",
      provider: modelConfig.provider,
      model: modelConfig.model,
      usage: null,
      purpose: modelConfig.purpose,
      systemPrompt,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "SENSE_INTERPRETER_FAILED"),
    });
    return null;
  }
}
