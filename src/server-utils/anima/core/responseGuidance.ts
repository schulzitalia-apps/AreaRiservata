import type { AnimaAgentState } from "./agentState";
import type { AnimaRunResult } from "./types";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";

type GuidanceField = {
  key: string;
  label: string;
  status: "missing" | "filled";
  value: string | null;
  promptHint: string;
  priority: number;
};

export type AnimaResponseGuidance = {
  mode:
    | "operation_clarification"
    | "result_delivery"
    | "conversation_expansion";
  operation: string | null;
  goal: string;
  askStyle: "collect_compactly" | "conversation_expand";
  followUpPolicy:
    | "none"
    | "soft_optional"
    | "invite_now";
  fieldsToCollect: GuidanceField[];
  nextQuestionStrategy: string;
  conversationOpenings: string[];
};

function stringifyValue(value: unknown): string | null {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => stringifyValue(item))
      .filter(Boolean)
      .join(", ");
    return items || null;
  }
  if (typeof value === "object") {
    return null;
  }
  return null;
}

function buildEventCreateFields(
  debug: Record<string, any> | undefined,
  operationState: AnimaAgentState["operationState"],
): GuidanceField[] {
  const missing = new Set<string>(
    debug?.missing ?? operationState?.missing ?? [],
  );
  const payload = debug?.payload ?? {};
  const pendingData =
    operationState?.operation === "event_create" ? operationState.data : {};

  const getStatus = (key: string) => (missing.has(key) ? "missing" : "filled");

  return [
    {
      key: "tipo evento",
      label: "tipo evento",
      status: getStatus("tipo evento"),
      value:
        stringifyValue(payload?.eventType?.label) ??
        stringifyValue((pendingData as any)?.eventTypeLabel),
      promptHint: "chiedi il tipo di evento se manca",
      priority: 1,
    },
    {
      key: "data/orario",
      label: "quando",
      status: getStatus("data/orario"),
      value:
        stringifyValue(payload?.startAt) ??
        stringifyValue((pendingData as any)?.startAt),
      promptHint:
        "prova a raccogliere giorno e fascia oraria nello stesso passaggio",
      priority: 2,
    },
    {
      key: "titolo",
      label: "titolo",
      status: getStatus("titolo"),
      value:
        stringifyValue(payload?.title) ??
        stringifyValue((pendingData as any)?.title),
      promptHint: "se possibile, fai emergere un titolo concreto",
      priority: 3,
    },
    {
      key: "note opzionali",
      label: "note",
      status: getStatus("note opzionali"),
      value:
        stringifyValue(payload?.notes) ??
        stringifyValue((pendingData as any)?.notes),
      promptHint:
        "le note sono opzionali, ma puoi chiederle insieme ad altri dettagli",
      priority: 4,
    },
  ];
}

function buildMailFollowupFields(
  debug: Record<string, any> | undefined,
): GuidanceField[] {
  const pending = debug?.pendingMailFollowup ?? {};
  const resolvedEmail =
    stringifyValue(debug?.recipientCandidate) ??
    stringifyValue(debug?.recipient) ??
    stringifyValue(pending?.data?.selectedTo) ??
    stringifyValue(pending?.data?.defaultTo);

  return [
    {
      key: "conferma invio",
      label: "conferma invio",
      status: "missing",
      value: null,
      promptHint: "chiedi una conferma esplicita ma naturale",
      priority: 1,
    },
    {
      key: "destinatario",
      label: "email destinatario",
      status: resolvedEmail ? "filled" : "missing",
      value: resolvedEmail,
      promptHint: "se serve, raccogli o conferma l'email destinatario",
      priority: 2,
    },
  ];
}

function buildGenericMailFields(
  debug: Record<string, any> | undefined,
): GuidanceField[] {
  const mailState =
    debug?.pendingGenericMail ??
    debug?.initialGenericMailState ??
    debug?.mergedMailState ??
    {};
  const missing = new Set<string>(mailState?.missing ?? []);

  return [
    {
      key: "destinatario",
      label: "destinatario",
      status: missing.has("destinatario") ? "missing" : "filled",
      value: stringifyValue(mailState?.data?.to),
      promptHint: "chiedi a chi deve andare la mail",
      priority: 1,
    },
    {
      key: "contenuto",
      label: "contenuto mail",
      status: missing.has("contenuto") ? "missing" : "filled",
      value: stringifyValue(mailState?.data?.message),
      promptHint: "aiuta l'utente a formulare un messaggio chiaro",
      priority: 2,
    },
    {
      key: "oggetto",
      label: "oggetto",
      status: mailState?.data?.subject ? "filled" : "missing",
      value: stringifyValue(mailState?.data?.subject),
      promptHint: "l'oggetto e utile ma secondario",
      priority: 3,
    },
  ];
}

function buildEventListFields(
  debug: Record<string, any> | undefined,
  operationState: AnimaAgentState["operationState"],
): GuidanceField[] {
  const missing = new Set<string>(
    debug?.missing ?? operationState?.missing ?? [],
  );
  const filters = debug?.filters ?? {};
  const pendingData =
    operationState?.operation === "event_list" ? operationState.data : {};

  return [
    {
      key: "tipo eventi",
      label: "tipo eventi",
      status: missing.has("tipo eventi") ? "missing" : "filled",
      value:
        stringifyValue(filters?.eventType?.label) ??
        stringifyValue((pendingData as any)?.eventTypeLabel),
      promptHint:
        "spingi a scegliere la tipologia di eventi da vedere, anche proponendo le tipologie disponibili",
      priority: 1,
    },
    {
      key: "quantita risultati",
      label: "quantita risultati",
      status: missing.has("quantita risultati") ? "missing" : "filled",
      value:
        stringifyValue(filters?.limit) ??
        ((filters?.wantsAll ?? (pendingData as any)?.wantsAll)
          ? "tutti"
          : null),
      promptHint:
        "cerca di farti dire subito quanti risultati servono oppure se li vuole tutti",
      priority: 2,
    },
    {
      key: "periodo",
      label: "periodo",
      status: "filled",
      value:
        stringifyValue(filters?.specificDate) ??
        stringifyValue(filters?.days) ??
        stringifyValue(filters?.futureDays) ??
        stringifyValue((pendingData as any)?.specificDate) ??
        stringifyValue((pendingData as any)?.days) ??
        stringifyValue((pendingData as any)?.futureDays),
      promptHint: "usa il periodo gia emerso come base della domanda",
      priority: 3,
    },
  ];
}

function buildAnagraficheReadFields(
  debug: Record<string, any> | undefined,
  operationState: AnimaAgentState["operationState"],
): GuidanceField[] {
  const missing = new Set<string>(
    debug?.missing ?? operationState?.missing ?? [],
  );
  const query = debug?.query ?? {};
  const pendingData =
    operationState?.operation === "anagrafiche_read" ? operationState.data : {};

  return [
    {
      key: "type",
      label: "tipo anagrafica",
      status: missing.has("type") ? "missing" : "filled",
      value:
        stringifyValue(query?.typeLabel) ??
        stringifyValue((pendingData as any)?.typeLabel),
      promptHint: "chiedi che tipo di anagrafica serve",
      priority: 1,
    },
    {
      key: "query",
      label: "record o ricerca",
      status:
        missing.has("query") || missing.has("record") ? "missing" : "filled",
      value:
        stringifyValue(query?.query) ??
        stringifyValue((pendingData as any)?.query) ??
        stringifyValue((pendingData as any)?.selectedRecordLabel),
      promptHint: "chiedi nome, chiave o record da leggere",
      priority: 2,
    },
    {
      key: "fields",
      label: "campi richiesti",
      status: missing.has("fields") ? "missing" : "filled",
      value:
        stringifyValue(query?.requestedFields) ??
        stringifyValue((pendingData as any)?.requestedFields),
      promptHint: "chiedi se servono campi specifici oppure la scheda completa",
      priority: 3,
    },
  ];
}

function buildAnagraficheCreateFields(
  debug: Record<string, any> | undefined,
  operationState: AnimaAgentState["operationState"],
): GuidanceField[] {
  const missing = new Set<string>(
    debug?.missing ?? operationState?.missing ?? [],
  );
  const query = debug?.query ?? {};
  const pendingData =
    operationState?.operation === "anagrafiche_create" ? operationState.data : {};
  const typeSlug =
    query?.typeSlug ??
    (pendingData as any)?.typeSlug ??
    null;
  const draftData =
    query?.draftData ??
    (pendingData as any)?.draftData ??
    {};
  const fundamentalLabels =
    typeSlug
      ? (getAnagraficaDef(typeSlug).preview.title ?? [])
          .map((fieldKey) => getAnagraficaDef(typeSlug).fields[fieldKey]?.label ?? fieldKey)
          .join(", ")
      : null;

  return [
    {
      key: "type",
      label: "tipo anagrafica",
      status: missing.has("type") ? "missing" : "filled",
      value:
        stringifyValue(query?.typeLabel) ??
        stringifyValue((pendingData as any)?.typeLabel),
      promptHint: "chiedi subito il tipo corretto della scheda da creare",
      priority: 1,
    },
    {
      key: "data",
      label: "dati fondamentali",
      status: missing.has("data") ? "missing" : "filled",
      value:
        stringifyValue(Object.keys(draftData as Record<string, unknown>)) ??
        fundamentalLabels,
      promptHint:
        "resta sui dati fondamentali del tipo scelto e consenti di fermarti quando la scheda e gia sensata",
      priority: 2,
    },
    {
      key: "confirm",
      label: "conferma creazione",
      status: missing.has("confirm") ? "missing" : "filled",
      value:
        query?.confirmWrite === true ||
        (pendingData as any)?.confirmWrite === true
          ? "confermata"
          : null,
      promptHint:
        "se i fondamentali ci sono, chiedi conferma finale o accetta formule come va bene cosi",
      priority: 3,
    },
  ];
}

function buildSprintTimelineFields(
  debug: Record<string, any> | undefined,
  operationState: AnimaAgentState["operationState"],
): GuidanceField[] {
  const missing = new Set<string>(
    debug?.missing ?? operationState?.missing ?? [],
  );
  const query = debug?.query ?? {};
  const pendingData =
    operationState?.operation === "sprint_timeline_read" ? operationState.data : {};

  return [
    {
      key: "scope",
      label: "perimetro",
      status: missing.has("scope") ? "missing" : "filled",
      value:
        stringifyValue(query?.scope) ??
        stringifyValue((pendingData as any)?.scope),
      promptHint: "chiedi se guardare me, una persona o tutta l azienda",
      priority: 1,
    },
    {
      key: "signal",
      label: "semaforo",
      status: missing.has("signal") ? "missing" : "filled",
      value:
        stringifyValue(query?.signals) ??
        stringifyValue((pendingData as any)?.signals),
      promptHint: "chiedi il semaforo solo se serve a sbloccare la query",
      priority: 2,
    },
    {
      key: "priority",
      label: "priorita",
      status: missing.has("priority") ? "missing" : "filled",
      value:
        stringifyValue(query?.priority) ??
        stringifyValue((pendingData as any)?.priority),
      promptHint: "chiedi priorita o finestra temporale solo se davvero mancanti",
      priority: 3,
    },
    {
      key: "task_query",
      label: "task specifico",
      status: missing.has("task_query") ? "missing" : "filled",
      value:
        stringifyValue(query?.taskQuery) ??
        stringifyValue((pendingData as any)?.taskQuery),
      promptHint: "chiedi il task specifico solo quando l utente vuole breakdown o focus puntuale",
      priority: 4,
    },
  ];
}

export function buildResponseGuidance(args: {
  state: AnimaAgentState;
  finalResult: AnimaRunResult;
}): AnimaResponseGuidance {
  const { state, finalResult } = args;
  const debug = finalResult.meta.debug ?? {};

  if (finalResult.meta.strategy === "event_create_clarification") {
    return {
      mode: "operation_clarification",
      operation: "event_create",
      goal: "Portare avanti la creazione evento raccogliendo piu dettagli utili possibile in modo naturale.",
      askStyle: "collect_compactly",
      followUpPolicy: "invite_now",
      fieldsToCollect: buildEventCreateFields(debug, state.operationState),
      nextQuestionStrategy:
        "Se puoi, unisci due dettagli compatibili nella stessa domanda senza sembrare un form.",
      conversationOpenings: [],
    };
  }

  if (finalResult.meta.strategy === "event_list_clarification") {
    return {
      mode: "operation_clarification",
      operation: "event_list",
      goal: "Portare avanti il listing raccogliendo i filtri piu utili prima di mostrare i risultati.",
      askStyle: "collect_compactly",
      followUpPolicy: "invite_now",
      fieldsToCollect: buildEventListFields(debug, state.operationState),
      nextQuestionStrategy:
        "Se puoi, chiedi insieme tipologia e quantita risultati, restando naturale e non troppo da form.",
      conversationOpenings: [],
    };
  }

  if (finalResult.meta.strategy === "anagrafiche_query_clarification") {
    return {
      mode: "operation_clarification",
      operation: "anagrafiche_read",
      goal: "Portare avanti la ricerca anagrafica raccogliendo il minimo dettaglio utile per arrivare al record o ai campi richiesti.",
      askStyle: "collect_compactly",
      followUpPolicy: "invite_now",
      fieldsToCollect: buildAnagraficheReadFields(debug, state.operationState),
      nextQuestionStrategy:
        "Fai una sola domanda naturale sul prossimo dettaglio utile: tipo, record o campi.",
      conversationOpenings: [],
    };
  }

  if (finalResult.meta.strategy === "anagrafiche_create_clarification") {
    return {
      mode: "operation_clarification",
      operation: "anagrafiche_create",
      goal: "Portare avanti la creazione anagrafica raccogliendo il minimo dettaglio utile e chiedendo conferma solo quando la scheda e pronta.",
      askStyle: "collect_compactly",
      followUpPolicy: "invite_now",
      fieldsToCollect: buildAnagraficheCreateFields(debug, state.operationState),
      nextQuestionStrategy:
        "Chiedi solo il prossimo dettaglio davvero utile: tipo, dato principale o conferma finale.",
      conversationOpenings: [],
    };
  }

  if (finalResult.meta.strategy === "sprint_timeline_query_clarification") {
    return {
      mode: "operation_clarification",
      operation: "sprint_timeline_read",
      goal: "Portare avanti la query task chiarendo perimetro, stato o finestra temporale senza sembrare un form.",
      askStyle: "collect_compactly",
      followUpPolicy: "invite_now",
      fieldsToCollect: buildSprintTimelineFields(debug, state.operationState),
      nextQuestionStrategy:
        "Chiedi solo il dettaglio che sblocca la lettura task piu utile nel prossimo passo.",
      conversationOpenings: [],
    };
  }

  if (
    finalResult.meta.strategy === "mail_clarification" &&
    state.operationState?.operation === "mail_followup"
  ) {
    return {
      mode: "operation_clarification",
      operation: "mail_followup",
      goal: "Chiudere il follow-up mail confermando invio e destinatario.",
      askStyle: "collect_compactly",
      followUpPolicy: "invite_now",
      fieldsToCollect: buildMailFollowupFields(debug),
      nextQuestionStrategy:
        "Chiedi conferma invio e, se utile, conferma anche il destinatario nello stesso passaggio.",
      conversationOpenings: [],
    };
  }

  if (
    finalResult.meta.strategy === "mail_clarification" &&
    (state.operationState?.operation === "generic_mail" ||
      debug?.pendingGenericMail ||
      debug?.initialGenericMailState ||
      debug?.mergedMailState)
  ) {
    return {
      mode: "operation_clarification",
      operation: "generic_mail",
      goal: "Portare avanti la mail raccogliendo destinatario e contenuto in modo conversazionale.",
      askStyle: "collect_compactly",
      followUpPolicy: "invite_now",
      fieldsToCollect: buildGenericMailFields(debug),
      nextQuestionStrategy:
        "Prova a farti dare in un solo scambio destinatario e contenuto essenziale.",
      conversationOpenings: [],
    };
  }

  if (
    finalResult.meta.strategy === "welcome_greeting" ||
    finalResult.meta.strategy === "event_create" ||
    finalResult.meta.strategy === "event_list" ||
    finalResult.meta.strategy === "event_recent_summary" ||
    finalResult.meta.strategy === "mail_reminder_sent" ||
    finalResult.meta.strategy === "anagrafiche_read" ||
    finalResult.meta.strategy === "anagrafiche_create" ||
    finalResult.meta.strategy === "anagrafiche_create_denied" ||
    finalResult.meta.strategy === "sprint_timeline_active_today" ||
    finalResult.meta.strategy === "sprint_timeline_due" ||
    finalResult.meta.strategy === "sprint_timeline_my_day" ||
    finalResult.meta.strategy === "sprint_timeline_priority_advice"
  ) {
    return {
      mode: "result_delivery",
      operation: state.operationState?.operation ?? null,
      goal: "Consegnare il risultato e, solo se utile, aprire il prossimo passo naturale.",
      askStyle: "conversation_expand",
      followUpPolicy:
        finalResult.meta.strategy === "welcome_greeting"
          ? "invite_now"
          : finalResult.meta.strategy === "event_create" ||
              finalResult.meta.strategy === "mail_reminder_sent"
            ? "soft_optional"
            : finalResult.meta.strategy === "anagrafiche_create_denied"
              ? "soft_optional"
            : "none",
      fieldsToCollect: [],
      nextQuestionStrategy:
        "Chiudi l'azione appena svolta e proponi il prossimo aiuto piu naturale, senza forzare.",
      conversationOpenings: [
        "Posso anche aiutarti a creare un altro evento completo di data, orario e titolo.",
        "Se vuoi, posso recuperarti eventi passati o futuri filtrati per periodo o tipo.",
        "Se ti serve, posso anche preparare o inviare una mail collegata.",
      ],
    };
  }

  return {
    mode: "conversation_expansion",
    operation: state.operationState?.operation ?? null,
    goal: "Tenere viva la conversazione orientandola verso operazioni utili e concrete senza sembrare un menu.",
    askStyle: "conversation_expand",
    followUpPolicy: "soft_optional",
    fieldsToCollect: [],
    nextQuestionStrategy:
      "Proponi uno o due sbocchi operativi naturali basati sul contesto appena emerso.",
    conversationOpenings: [
      "Posso aiutarti a creare un appuntamento se mi dici quando e, se vuoi, anche il titolo.",
      "Posso mostrarti eventi recenti o futuri con filtri semplici.",
      "Se ti serve, posso anche gestire un promemoria o una mail.",
    ],
  };
}
