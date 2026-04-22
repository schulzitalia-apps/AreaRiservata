import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";

export type AnimaProcessExecutionKind =
  | "deterministic"
  | "templated"
  | "hybrid"
  | "llm";

export type AnimaProcessNodeConfig = {
  id: string;
  label: string;
  description: string;
  execution: {
    kind: AnimaProcessExecutionKind;
    whenLlmRuns: string;
    defaultBehavior: string;
    model:
      | {
          provider: string;
          model: string | null;
          source: string;
        }
      | null;
  };
  handlers: string[];
  next: string[];
};

export type AnimaProcessFlowConfig = {
  id: string;
  label: string;
  entrypoint: string;
  steps: string[];
  notes: string[];
};

export type AnimaTargetCheckpointConfig = {
  id: string;
  label: string;
  description: string;
};

export type AnimaTargetStateConfig = {
  area: "operationLifecycle" | "guardrailColors" | "responseMode";
  values: string[];
};

const runtimeChatProvider = ANIMA_RUNTIME_CONFIG.llm.provider;
const runtimeChatModel =
  ANIMA_RUNTIME_CONFIG.llm.provider === "glm"
    ? ANIMA_RUNTIME_CONFIG.llm.providers.glm.model
    : ANIMA_RUNTIME_CONFIG.llm.providers.groq.model;

export const ANIMA_PROCESS_NODES: readonly AnimaProcessNodeConfig[] = [
  {
    id: "input.normalize",
    label: "Normalizzazione Input",
    description:
      "Crea il contesto base del turno, normalizza messaggio, canale, utente e debug options.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai",
      defaultBehavior: "Sempre codice deterministico.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/core/context.ts",
      "src/server-utils/anima/core/types.ts",
    ],
    next: ["memory.load", "greeting.check"],
  },
  {
    id: "memory.load",
    label: "Caricamento Memorie",
    description:
      "Legge memoria operativa e memoria conversazionale della sessione corrente.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai",
      defaultBehavior: "Sempre codice deterministico.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/memory/sessionState.ts",
      "src/server-utils/anima/memory/conversationState.ts",
    ],
    next: ["operation.guardrails", "intent.parse"],
  },
  {
    id: "greeting.check",
    label: "Saluto Iniziale",
    description:
      "Se e il primo saluto della sessione, risponde con welcome templated e chiude il turno.",
    execution: {
      kind: "templated",
      whenLlmRuns: "Mai",
      defaultBehavior: "Usa `buildWelcomeReply`.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/features/eventi/eventi.lowValue.ts",
      "src/server-utils/anima/responders/conversation.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["operation.guardrails", "response.final"],
  },
  {
    id: "operation.guardrails",
    label: "Guardrail Stateful",
    description:
      "Se c'e un'operazione aperta interpreta il turno come cancel, submit o completamento del task in corso.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai",
      defaultBehavior: "Usa la memoria operativa come source of truth.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/core/operationGuardrails.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["pending.mail_followup", "pending.generic_mail", "pending.event_create", "intent.parse"],
  },
  {
    id: "intent.parse",
    label: "Parsing Intent Deterministico",
    description:
      "Prova a riconoscere create, list, recent, generic mail, low-value e discovery eventi.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai nel core Anima attuale.",
      defaultBehavior: "Regex/parser/funzioni config-driven.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/features/eventi/eventi.create.ts",
      "src/server-utils/anima/features/eventi/eventi.list.ts",
      "src/server-utils/anima/features/eventi/eventi.recent.ts",
      "src/server-utils/anima/features/mail/genericMail.ts",
      "src/server-utils/anima/features/eventi/eventi.lowValue.ts",
    ],
    next: [
      "event.create.flow",
      "mail.generic.flow",
      "mail.digest.flow",
      "event.list.flow",
      "event.recent.flow",
      "fallback.not_understood",
    ],
  },
  {
    id: "event.create.flow",
    label: "Creazione Evento",
    description:
      "Aggiorna piano create, chiede i campi mancanti o esegue la create quando il payload e completo.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai per decidere o creare.",
      defaultBehavior: "Prompt templated per chiarimenti e conferme.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/features/eventi/eventi.create.ts",
      "src/server-utils/anima/responders/conversation.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["mail.followup.flow", "response.final"],
  },
  {
    id: "mail.followup.flow",
    label: "Follow-up Mail Post Create",
    description:
      "Dopo una create riuscita apre un task breve `mail_followup` e aspetta si/no/altra mail.",
    execution: {
      kind: "hybrid",
      whenLlmRuns:
        "Il flow e deterministico; l'LLM parte solo nella composizione della mail finale.",
      defaultBehavior: "Domande e conferme sono templated.",
      model: {
        provider: ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer.provider,
        model: ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer.model,
        source: "ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer",
      },
    },
    handlers: [
      "src/server-utils/anima/features/mail/animaReminderMail.ts",
      "src/server-utils/anima/responders/conversation.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["response.final"],
  },
  {
    id: "mail.generic.flow",
    label: "Mail Generica",
    description:
      "Gestisce una mail libera con destinatario scelto, chiedendo i campi mancanti se servono.",
    execution: {
      kind: "hybrid",
      whenLlmRuns:
        "Il flow e deterministico; l'LLM parte solo nel composer che genera subject/html.",
      defaultBehavior: "Questionari recipient/content templated.",
      model: {
        provider: ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer.provider,
        model: ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer.model,
        source: "ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer",
      },
    },
    handlers: [
      "src/server-utils/anima/features/mail/genericMail.ts",
      "src/server-utils/anima/features/mail/animaReminderMail.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["response.final"],
  },
  {
    id: "mail.digest.flow",
    label: "Digest Eventi via Mail",
    description:
      "Se l'utente chiede un promemoria o breakdown eventi via mail, raccoglie gli eventi e poi compone la mail.",
    execution: {
      kind: "hybrid",
      whenLlmRuns:
        "L'LLM parte solo nella composizione della mail; list e filtri restano deterministici.",
      defaultBehavior: "Filtro eventi e invio sono codice deterministico.",
      model: {
        provider: ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer.provider,
        model: ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer.model,
        source: "ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer",
      },
    },
    handlers: [
      "src/server-utils/anima/features/eventi/eventi.list.ts",
      "src/server-utils/anima/features/mail/animaReminderMail.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["response.final"],
  },
  {
    id: "event.list.flow",
    label: "Lettura Eventi",
    description:
      "Legge eventi per tipo, data, periodo passato o futuro e produce risposta conversazionale templated.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai",
      defaultBehavior: "Query e rendering risposta senza LLM.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/features/eventi/eventi.list.ts",
      "src/server-utils/anima/features/eventi/eventi.respond.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["response.final"],
  },
  {
    id: "event.recent.flow",
    label: "Recap Eventi Recenti",
    description:
      "Legge gli ultimi X giorni e restituisce un riassunto deterministicamente costruito.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai",
      defaultBehavior: "Summary e testo finale senza LLM.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/features/eventi/eventi.recent.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["response.final"],
  },
  {
    id: "fallback.not_understood",
    label: "Fallback Non Ho Capito",
    description:
      "Se nessun ramo plausibile matcha, risponde con aiuto capability-first e esempi guida.",
    execution: {
      kind: "templated",
      whenLlmRuns: "Mai",
      defaultBehavior: "Usa `buildCapabilitiesReply`.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/responders/conversation.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["response.final"],
  },
  {
    id: "meta_whatsapp.router",
    label: "Meta WhatsApp Router Legacy",
    description:
      "Nel webhook legacy CRM decide se fare search cliente o chat normale.",
    execution: {
      kind: "llm",
      whenLlmRuns: "Sempre quando arriva un testo nel webhook legacy Meta.",
      defaultBehavior: "Se il parsing JSON fallisce, fallback a `chat`.",
      model: {
        provider:
          ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.legacyMetaWhatsappRouter.provider,
        model:
          ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.legacyMetaWhatsappRouter.model,
        source:
          "ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.legacyMetaWhatsappRouter",
      },
    },
    handlers: ["src/app/api/meta-whatsapp-webhook/route.ts"],
    next: ["meta_whatsapp.chat"],
  },
  {
    id: "meta_whatsapp.chat",
    label: "Meta WhatsApp Chat Legacy",
    description:
      "Nel webhook legacy CRM genera la risposta finale di chat quando non basta il contesto cliente diretto.",
    execution: {
      kind: "llm",
      whenLlmRuns:
        "Solo se non siamo in risposta diretta cliente-context e non siamo in search pura.",
      defaultBehavior:
        "Se la chiamata LLM fallisce, risponde con messaggio di errore statico.",
      model: {
        provider:
          ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.legacyMetaWhatsappChat.provider,
        model:
          ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.legacyMetaWhatsappChat.model,
        source:
          "ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.legacyMetaWhatsappChat",
      },
    },
    handlers: ["src/app/api/meta-whatsapp-webhook/route.ts"],
    next: ["response.final"],
  },
  {
    id: "response.final",
    label: "Risposta Finale",
    description:
      "Consegna il testo finale al canale e prepara il debug della run.",
    execution: {
      kind: "templated",
      whenLlmRuns: "Mai nel core Anima; puo gia arrivare testo generato da step precedenti.",
      defaultBehavior: "Sempre codice deterministico.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/core/respond.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: [],
  },
] as const;

export const ANIMA_PROCESS_FLOWS: readonly AnimaProcessFlowConfig[] = [
  {
    id: "anima.core.turn",
    label: "Core Turn Anima",
    entrypoint: "input.normalize",
    steps: [
      "input.normalize",
      "memory.load",
      "greeting.check",
      "operation.guardrails",
      "intent.parse",
      "event.create.flow",
      "mail.followup.flow",
      "mail.generic.flow",
      "mail.digest.flow",
      "event.list.flow",
      "event.recent.flow",
      "fallback.not_understood",
      "response.final",
    ],
    notes: [
      "Nel core live il turno parte dal sense interpreter e puo aprire o continuare operazioni gia da li.",
      "I filler LLM compilano i payload operativi anche per list/read, mentre i parser deterministic fanno da fallback e validazione.",
      "Il sense interpreter e i responder ricevono anche il quadro dei registry Anagrafiche, Aule ed Eventi per orientare subito il turno verso il dominio corretto.",
      "Il guardrail emotivo e il response composer completano il lato conversazionale del runtime.",
    ],
  },
  {
    id: "anima.meta_whatsapp.legacy",
    label: "Meta WhatsApp Legacy CRM",
    entrypoint: "meta_whatsapp.router",
    steps: [
      "meta_whatsapp.router",
      "meta_whatsapp.chat",
      "response.final",
    ],
    notes: [
      "Questo flow e separato dal core `runAnima`.",
      "Usa provider runtime condiviso ma logica legacy CRM distinta.",
    ],
  },
] as const;

export const ANIMA_TARGET_CHECKPOINTS: readonly AnimaTargetCheckpointConfig[] =
  ANIMA_RUNTIME_CONFIG.targetRuntime.checkpoints.map((checkpoint) => ({
    id: checkpoint,
    label: checkpoint,
    description:
      checkpoint === "sense_interpreted"
        ? "Il primo interprete di senso ha letto il turno nel contesto della conversazione."
        : checkpoint === "operation_routed"
          ? "Il runtime ha deciso se aprire una nuova operazione o restare su una gia aperta."
          : checkpoint === "operation_updated"
            ? "Il JSON operativo e stato arricchito con nuovi dati o chiarimenti."
            : checkpoint === "operation_ready_or_blocked"
              ? "L'operazione e stata marcata come pronta oppure bloccata per campi mancanti."
              : checkpoint === "guardrail_colored"
                ? "Il guardrail finale ha assegnato verde, arancione o rosso."
                : checkpoint === "response_composed"
                  ? "La risposta finale e stata costruita in modalita funzionale o estesa."
                  : checkpoint === "memory_summarized"
                    ? "La memoria breve e stata aggiornata con il turno e il risultato."
                    : "La memoria lunga e stata consolidata spostando i fatti stabili.",
  }));

export const ANIMA_TARGET_STATES: readonly AnimaTargetStateConfig[] = [
  {
    area: "operationLifecycle",
    values: ANIMA_RUNTIME_CONFIG.targetRuntime.states.operationLifecycle,
  },
  {
    area: "guardrailColors",
    values: ANIMA_RUNTIME_CONFIG.targetRuntime.states.guardrailColors,
  },
  {
    area: "responseMode",
    values: ["functional", "extended"],
  },
] as const;

export const ANIMA_TARGET_PROCESS_NODES: readonly AnimaProcessNodeConfig[] = [
  {
    id: "welcome.entry",
    label: "Welcome Deterministico",
    description:
      "Se e primo contatto o primo saluto, apre con un welcome sciolto ma deterministic e capability concise.",
    execution: {
      kind: "templated",
      whenLlmRuns: "Mai",
      defaultBehavior: "Messaggio breve, caldo e controllato.",
      model: null,
    },
    handlers: [
      "src/server-utils/anima/responders/conversation.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["sense.interpreter"],
  },
  {
    id: "sense.interpreter",
    label: "Interprete di Senso",
    description:
      "Legge il turno come classificatore pre-operazionale e decide solo verso quale processo specialistico indirizzare il messaggio.",
    execution: {
      kind: "llm",
      whenLlmRuns: "Sempre dopo il caricamento delle memorie, tranne fast-path banalissimi di saluto.",
      defaultBehavior:
        "Produce un esito strutturato con processo scelto, confidenza e motivazione breve.",
      model: {
        provider: ANIMA_RUNTIME_CONFIG.targetRuntime.models.senseInterpreter.provider,
        model: ANIMA_RUNTIME_CONFIG.targetRuntime.models.senseInterpreter.model,
        source: "ANIMA_RUNTIME_CONFIG.targetRuntime.models.senseInterpreter",
      },
    },
    handlers: [
      "live: src/server-utils/anima/nodes/senseInterpreter.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["operation.router", "emotional.guardrail", "response.composer"],
  },
  {
    id: "operation.router",
    label: "Router Operazioni",
    description:
      "Decide se aprire una nuova operazione, tenere viva un'operazione aperta o delegare al guardrail finale.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai, usa stato operativo e risultato dell'interprete di senso.",
      defaultBehavior:
        "Sceglie una branch esplicita del turno: create, list, mail, digest, guardrail o fallback.",
      model: {
        provider:
          ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationRouter.provider,
        model: ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationRouter.model,
        source: "ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationRouter",
      },
    },
    handlers: [
      "live: src/server-utils/anima/nodes/operationRouter.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["operation.context_filler", "operation.executor", "emotional.guardrail"],
  },
  {
    id: "operation.context_filler",
    label: "Filler Contesto Operativo",
    description:
      "Una volta scelto il branch, agisce come sense specialistico del dominio e prova a completare il JSON operativo dal turno.",
    execution: {
      kind: "llm",
      whenLlmRuns:
        "Solo quando c'e una operation aperta o quando il router ha scelto di aprirne una nuova da strutturare.",
      defaultBehavior:
        "Aggiorna il JSON operativo, omette dettagli non necessari e segnala solo i mancanti davvero utili.",
      model: {
        provider:
          ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller.provider,
        model: ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller.model,
        source: "ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationContextFiller",
      },
    },
    handlers: [
      "live: src/server-utils/anima/nodes/operationContextFiller.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["operation.executor", "response.composer"],
  },
  {
    id: "operation.executor",
    label: "Esecutore Operazioni",
    description:
      "Se il JSON operativo e pronto esegue il comando, azzera o archivia lo stato operativo e riavvia il ciclo.",
    execution: {
      kind: "deterministic",
      whenLlmRuns: "Mai",
      defaultBehavior:
        "Valuta readiness dell'operazione ed esegue create/edit/delete/list.",
      model: {
        provider:
          ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationExecutor.provider,
        model: ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationExecutor.model,
        source: "ANIMA_RUNTIME_CONFIG.targetRuntime.models.operationExecutor",
      },
    },
    handlers: [
      "live: src/server-utils/anima/nodes/operationExecutor.ts",
      "src/server-utils/anima/runAnima.ts",
    ],
    next: ["memory.short_term", "response.composer"],
  },
  {
    id: "memory.short_term",
    label: "Memoria Breve",
    description:
      "Riassume cose appena dette, passaggi fatti e realta operativa recente per il turno successivo.",
    execution: {
      kind: "llm",
      whenLlmRuns: "Dopo ogni turno significativo o dopo un comando eseguito.",
      defaultBehavior:
        "Tiene vicini fatti recenti, risultati ottenuti e riferimenti contestuali ancora vivi.",
      model: {
        provider:
          ANIMA_RUNTIME_CONFIG.targetRuntime.models.shortTermMemorySummarizer.provider,
        model:
          ANIMA_RUNTIME_CONFIG.targetRuntime.models.shortTermMemorySummarizer.model,
        source:
          "ANIMA_RUNTIME_CONFIG.targetRuntime.models.shortTermMemorySummarizer",
      },
    },
    handlers: [
      "target: short term memory",
      "future: src/server-utils/anima/nodes/shortTermMemory.ts",
    ],
    next: ["memory.long_term", "response.composer"],
  },
  {
    id: "memory.long_term",
    label: "Memoria Lunga",
    description:
      "Consolida i fatti stabili, sposta in piu vecchio le cose stale e pota quelle non utili.",
    execution: {
      kind: "llm",
      whenLlmRuns: "A fine turno o in consolidamento periodico.",
      defaultBehavior:
        "Riduce rumore e mantiene solo fatti che meritano recupero futuro.",
      model: {
        provider:
          ANIMA_RUNTIME_CONFIG.targetRuntime.models.longTermMemoryConsolidator.provider,
        model:
          ANIMA_RUNTIME_CONFIG.targetRuntime.models.longTermMemoryConsolidator.model,
        source:
          "ANIMA_RUNTIME_CONFIG.targetRuntime.models.longTermMemoryConsolidator",
      },
    },
    handlers: [
      "target: long term memory",
      "future: src/server-utils/anima/nodes/longTermMemory.ts",
    ],
    next: ["response.composer"],
  },
  {
    id: "emotional.guardrail",
    label: "Guardrail Emotivo",
    description:
      "Se il caso non e rosso ma resta vago, distingue tra arancione e rosso e decide se parlare come assistente personale o chiudere con fallback netto.",
    execution: {
      kind: "llm",
      whenLlmRuns:
        "Solo quando l'interprete di senso non produce una risposta o un'operazione sufficientemente chiara.",
      defaultBehavior:
        "Produce colore verde/arancione/rosso e motivazione conversazionale.",
      model: {
        provider: ANIMA_RUNTIME_CONFIG.targetRuntime.models.emotionalEvaluator.provider,
        model: ANIMA_RUNTIME_CONFIG.targetRuntime.models.emotionalEvaluator.model,
        source: "ANIMA_RUNTIME_CONFIG.targetRuntime.models.emotionalEvaluator",
      },
    },
    handlers: [
      "target: emotional guardrail",
      "live: src/server-utils/anima/nodes/emotionalGuardrail.ts",
    ],
    next: ["response.composer"],
  },
  {
    id: "response.composer",
    label: "Composer Risposta",
    description:
      "Aggrega esito degli operatori precedenti e decide se restare funzionale/deterministico o fare una risposta piu estesa e naturale.",
    execution: {
      kind: "hybrid",
      whenLlmRuns:
        "Parte solo se la modalita estesa e attiva o se il caso richiede una riformulazione personale.",
      defaultBehavior:
        "Per i casi semplici puo mandare dritto la risposta deterministic senza memoria estesa.",
      model: {
        provider: ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer.provider,
        model: ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer.model,
        source: "ANIMA_RUNTIME_CONFIG.targetRuntime.models.responseComposer",
      },
    },
    handlers: [
      "target: response composer",
      "future: src/server-utils/anima/nodes/responseComposer.ts",
    ],
    next: [],
  },
] as const;

export const ANIMA_TARGET_PROCESS_FLOW: readonly AnimaProcessFlowConfig[] = [
  {
    id: "anima.target.turn",
    label: "Target Runtime Turn",
    entrypoint: "welcome.entry",
    steps: [
      "welcome.entry",
      "sense.interpreter",
      "operation.router",
      "operation.context_filler",
      "operation.executor",
      "memory.short_term",
      "memory.long_term",
      "emotional.guardrail",
      "response.composer",
    ],
    notes: [
      "Questo e il flow verso cui il runtime live e ormai allineato nella parte centrale del turno.",
      "L'interpretazione del testo e agentica gia all'inizio del turno.",
      "I registry di dominio sono parte del contesto dei nodi LLM e orientano l'apertura dello stato specialistico.",
      "La memoria breve e lunga diventano parte attiva dell'interpretazione e non solo storage.",
    ],
  },
] as const;

export const ANIMA_PROCESS_CONFIG = {
  sourceOfTruth: [
    "src/server-utils/anima/runAnima.ts",
    "src/server-utils/anima/config/anima.runtime.config.ts",
    "src/server-utils/anima/core/anima.processes.config.ts",
  ],
  activeRuntime: {
    chatProvider: runtimeChatProvider,
    chatModel: runtimeChatModel,
    mailComposerModel:
      ANIMA_RUNTIME_CONFIG.execution.llmActivatedSteps.mailComposer.model,
    speechToTextModel: ANIMA_RUNTIME_CONFIG.models.speechToText.model,
  },
  targetRuntime: {
    enabled: ANIMA_RUNTIME_CONFIG.targetRuntime.enabled,
    checkpoints: ANIMA_TARGET_CHECKPOINTS,
    states: ANIMA_TARGET_STATES,
    nodes: ANIMA_TARGET_PROCESS_NODES,
    flows: ANIMA_TARGET_PROCESS_FLOW,
  },
  nodes: ANIMA_PROCESS_NODES,
  flows: ANIMA_PROCESS_FLOWS,
} as const;
