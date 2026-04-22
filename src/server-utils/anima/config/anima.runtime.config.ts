import { LLM_RUNTIME_CONFIG } from "@/server-utils/llm";

// TODO: spostare questa config in src/config quando Anima diventa condivisa anche fuori da server-utils/anima

export type AnimaStepConfig = {
  mode: "deterministic" | "templated" | "hybrid" | "llm";
  model: string | null;
};

export type AnimaProviderModelVariants = {
  groq: {
    model: string | null;
  };
  glm: {
    model: string | null;
  };
};

export type AnimaLlmNodeRuntimeConfig = {
  mode: "deterministic" | "templated" | "hybrid" | "llm";
  provider: "groq" | "glm";
  model: string | null;
  variants: AnimaProviderModelVariants;
  purpose: string;
};

type AnimaModelTier = "fast" | "strong" | "premium";

const SAFE_GROQ_DEFAULT_MODEL =
  process.env.ANIMA_GROQ_SAFE_MODEL?.trim() ||
  "meta-llama/llama-4-scout-17b-16e-instruct";

function buildProviderModelVariants(args: {
  groqModel: string | null;
  glmModel: string | null;
}) {
  return {
    groq: {
      model: args.groqModel,
    },
    glm: {
      model: args.glmModel,
    },
  } satisfies AnimaProviderModelVariants;
}

function resolveProviderNodeConfig(args: {
  mode: "deterministic" | "templated" | "hybrid" | "llm";
  groqModel: string | null;
  glmModel: string | null;
  purpose: string;
}): AnimaLlmNodeRuntimeConfig {
  const variants = buildProviderModelVariants({
    groqModel: args.groqModel,
    glmModel: args.glmModel,
  });

  const provider = LLM_RUNTIME_CONFIG.chat.provider;
  const model =
    provider === "glm" ? variants.glm.model : variants.groq.model;

  return {
    mode: args.mode,
    provider,
    model,
    variants,
    purpose: args.purpose,
  };
}

const ANIMA_MODEL_ROLE_DEFAULTS = {
  groq: {
    // Groq free tier: Scout gives us much more TPM/TPD headroom than 8b/70b
    // while staying general-purpose enough for JSON filling and final replies.
    fast: process.env.ANIMA_GROQ_FAST_MODEL?.trim() || SAFE_GROQ_DEFAULT_MODEL,
    strong:
      process.env.ANIMA_GROQ_STRONG_MODEL?.trim() || SAFE_GROQ_DEFAULT_MODEL,
    premium:
      process.env.ANIMA_GROQ_PREMIUM_MODEL?.trim() || SAFE_GROQ_DEFAULT_MODEL,
  },
  glm: {
    fast:
      process.env.ANIMA_GLM_FAST_MODEL?.trim() ||
      process.env.GLM_MODEL?.trim() ||
      LLM_RUNTIME_CONFIG.chat.glm.model,
    strong:
      process.env.ANIMA_GLM_STRONG_MODEL?.trim() ||
      process.env.GLM_MODEL?.trim() ||
      LLM_RUNTIME_CONFIG.chat.glm.model,
    premium:
      process.env.ANIMA_GLM_PREMIUM_MODEL?.trim() ||
      process.env.GLM_MODEL?.trim() ||
      LLM_RUNTIME_CONFIG.chat.glm.model,
  },
} as const;

function resolveTierModel(args: {
  provider: "groq" | "glm";
  tier: AnimaModelTier;
  providerSpecificEnv?: string | undefined;
  genericEnv?: string | undefined;
}) {
  return (
    args.providerSpecificEnv?.trim() ||
    args.genericEnv?.trim() ||
    ANIMA_MODEL_ROLE_DEFAULTS[args.provider][args.tier]
  );
}

type AnimaHelpExample = {
  label: string;
  prompt: string;
};

export const ANIMA_RUNTIME_CONFIG = {
  todo: {
    moveToSharedConfig: true,
    extractTelegramWebhookAdapter: true,
    centralizeLlmProviderOutsideAnima: true,
  },
  llm: {
    provider: LLM_RUNTIME_CONFIG.chat.provider,
    providers: {
      groq: {
        model: LLM_RUNTIME_CONFIG.chat.groq.model,
        baseUrl: LLM_RUNTIME_CONFIG.chat.groq.baseUrl,
      },
      glm: {
        model: LLM_RUNTIME_CONFIG.chat.glm.model,
        baseUrl: LLM_RUNTIME_CONFIG.chat.glm.baseUrl,
        enableThinking: LLM_RUNTIME_CONFIG.chat.glm.enableThinking,
      },
    },
    roleDefaults: ANIMA_MODEL_ROLE_DEFAULTS,
  },
  execution: {
    coreDecisionMode: "deterministic" as const,
    defaultReplyMode: "templated" as const,
    notes: [
      "Nel core runAnima live il sense interpreter e il context filler guidano l'apertura e la compilazione delle operazioni.",
      "I parser deterministic restano come fallback, validazione e guardrail strutturale prima dell'esecuzione.",
      "Il ramo mail usa ancora un composer LLM separato per subject/html.",
      "I webhook legacy possono avere step LLM dedicati fuori dal core runAnima.",
    ],
    llmActivatedSteps: {
      mailComposer: {
        ...resolveProviderNodeConfig({
          mode: "hybrid",
          groqModel: resolveTierModel({
            provider: "groq",
            tier: "premium",
            providerSpecificEnv: process.env.ANIMA_MAIL_COMPOSER_MODEL_GROQ,
            genericEnv: process.env.ANIMA_MAIL_COMPOSER_MODEL,
          }),
          glmModel: resolveTierModel({
            provider: "glm",
            tier: "premium",
            providerSpecificEnv: process.env.ANIMA_MAIL_COMPOSER_MODEL_GLM,
            genericEnv: process.env.ANIMA_MAIL_COMPOSER_MODEL,
          }),
          purpose: "Comporre subject e HTML delle email di Anima.",
        }),
        file: "src/server-utils/anima/mailComposer.ts",
      },
      legacyMetaWhatsappRouter: {
        ...resolveProviderNodeConfig({
          mode: "llm",
          groqModel:
            process.env.META_WHATSAPP_ROUTER_MODEL_GROQ?.trim() ||
            process.env.META_WHATSAPP_ROUTER_MODEL?.trim() ||
            LLM_RUNTIME_CONFIG.chat.groq.model,
          glmModel:
            process.env.META_WHATSAPP_ROUTER_MODEL_GLM?.trim() ||
            process.env.META_WHATSAPP_ROUTER_MODEL?.trim() ||
            LLM_RUNTIME_CONFIG.chat.glm.model,
          purpose: "Instradare il webhook legacy Meta tra chat e search cliente.",
        }),
        file: "src/app/api/meta-whatsapp-webhook/route.ts",
      },
      legacyMetaWhatsappChat: {
        ...resolveProviderNodeConfig({
          mode: "llm",
          groqModel:
            process.env.META_WHATSAPP_CHAT_MODEL_GROQ?.trim() ||
            process.env.META_WHATSAPP_CHAT_MODEL?.trim() ||
            LLM_RUNTIME_CONFIG.chat.groq.model,
          glmModel:
            process.env.META_WHATSAPP_CHAT_MODEL_GLM?.trim() ||
            process.env.META_WHATSAPP_CHAT_MODEL?.trim() ||
            LLM_RUNTIME_CONFIG.chat.glm.model,
          purpose: "Generare la risposta finale del webhook legacy Meta.",
        }),
        file: "src/app/api/meta-whatsapp-webhook/route.ts",
      },
      speechToText: {
        provider: "groq",
        model: process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
        variants: buildProviderModelVariants({
          groqModel: process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
          glmModel: null,
        }),
        purpose: "Trascrivere audio in testo per il test vocale interno.",
        file: "src/app/api/anima/transcribe/route.ts",
      },
    },
  },
  targetRuntime: {
    enabled: true,
    responseStyle: {
      defaultMode: "functional" as const,
      allowExtendedMode: true,
      allowFunctionalMode: true,
      uiTogglePlanned: true,
    },
    memory: {
      shortTermEnabled: true,
      longTermEnabled: true,
      summarizeAfterEachTurn: true,
      consolidateOlderFacts: true,
      pruneIrrelevantFacts: true,
    },
    checkpoints: [
      "sense_interpreted",
      "operation_routed",
      "operation_updated",
      "operation_ready_or_blocked",
      "guardrail_colored",
      "response_composed",
      "memory_summarized",
      "memory_consolidated",
    ],
    states: {
      operationLifecycle: [
        "idle",
        "opening",
        "collecting",
        "ready",
        "executing",
        "executed",
        "cancelled",
        "blocked",
      ],
      guardrailColors: ["green", "orange", "red"],
    },
    models: {
      operationSwitcher: {
        ...resolveProviderNodeConfig({
          mode: "llm",
          groqModel: resolveTierModel({
            provider: "groq",
            tier: "fast",
            providerSpecificEnv: process.env.ANIMA_OPERATION_SWITCHER_MODEL_GROQ,
            genericEnv: process.env.ANIMA_OPERATION_SWITCHER_MODEL,
          }),
          glmModel: resolveTierModel({
            provider: "glm",
            tier: "fast",
            providerSpecificEnv: process.env.ANIMA_OPERATION_SWITCHER_MODEL_GLM,
            genericEnv: process.env.ANIMA_OPERATION_SWITCHER_MODEL,
          }),
          purpose:
            "Decidere se un messaggio continua, annulla o abbandona una operazione gia aperta, producendo una patch utile al filler.",
        }),
      },
      senseInterpreter: {
        ...resolveProviderNodeConfig({
          mode: "llm",
          groqModel: resolveTierModel({
            provider: "groq",
            tier: "fast",
            providerSpecificEnv: process.env.ANIMA_SENSE_MODEL_GROQ,
            genericEnv: process.env.ANIMA_SENSE_MODEL,
          }),
          glmModel: resolveTierModel({
            provider: "glm",
            tier: "fast",
            providerSpecificEnv: process.env.ANIMA_SENSE_MODEL_GLM,
            genericEnv: process.env.ANIMA_SENSE_MODEL,
          }),
          purpose:
            "Leggere il testo nel contesto della conversazione e capire se aprire una nuova operazione o arricchirne una gia aperta.",
        }),
      },
      operationRouter: {
        ...resolveProviderNodeConfig({
          mode: "deterministic",
          groqModel: null,
          glmModel: null,
          purpose:
            "Scegliere deterministicamente la corsia del turno usando interprete di senso, stato operativo e parser disponibili.",
        }),
      },
      operationContextFiller: {
        ...resolveProviderNodeConfig({
          mode: "llm",
          groqModel: resolveTierModel({
            provider: "groq",
            tier: "fast",
            providerSpecificEnv: process.env.ANIMA_OPERATION_FILLER_MODEL_GROQ,
            genericEnv: process.env.ANIMA_OPERATION_FILLER_MODEL,
          }),
          glmModel: resolveTierModel({
            provider: "glm",
            tier: "fast",
            providerSpecificEnv: process.env.ANIMA_OPERATION_FILLER_MODEL_GLM,
            genericEnv: process.env.ANIMA_OPERATION_FILLER_MODEL,
          }),
          purpose:
            "Estrarre completamenti strutturati dal messaggio utente per il JSON dell'operazione aperta.",
        }),
      },
      operationExecutor: {
        ...resolveProviderNodeConfig({
          mode: "deterministic",
          groqModel: null,
          glmModel: null,
          purpose:
            "Eseguire il side effect dell'operazione quando il JSON operativo e pronto, senza usare LLM.",
        }),
      },
      shortTermMemorySummarizer: {
        ...resolveProviderNodeConfig({
          mode: "llm",
          groqModel: resolveTierModel({
            provider: "groq",
            tier: "fast",
            providerSpecificEnv: process.env.ANIMA_MEMORY_SHORT_MODEL_GROQ,
            genericEnv: process.env.ANIMA_MEMORY_SHORT_MODEL,
          }),
          glmModel: resolveTierModel({
            provider: "glm",
            tier: "fast",
            providerSpecificEnv: process.env.ANIMA_MEMORY_SHORT_MODEL_GLM,
            genericEnv: process.env.ANIMA_MEMORY_SHORT_MODEL,
          }),
          purpose:
            "Riassumere turni recenti, decisioni e passaggi completati in memoria breve.",
        }),
      },
      longTermMemoryConsolidator: {
        ...resolveProviderNodeConfig({
          mode: "llm",
          groqModel: resolveTierModel({
            provider: "groq",
            tier: "strong",
            providerSpecificEnv: process.env.ANIMA_MEMORY_LONG_MODEL_GROQ,
            genericEnv: process.env.ANIMA_MEMORY_LONG_MODEL,
          }),
          glmModel: resolveTierModel({
            provider: "glm",
            tier: "strong",
            providerSpecificEnv: process.env.ANIMA_MEMORY_LONG_MODEL_GLM,
            genericEnv: process.env.ANIMA_MEMORY_LONG_MODEL,
          }),
          purpose:
            "Spostare nel lungo termine solo i fatti stabili o utili e potare il resto.",
        }),
      },
      emotionalEvaluator: {
        ...resolveProviderNodeConfig({
          mode: "llm",
          groqModel: resolveTierModel({
            provider: "groq",
            tier: "strong",
            providerSpecificEnv: process.env.ANIMA_EMOTIONAL_MODEL_GROQ,
            genericEnv: process.env.ANIMA_EMOTIONAL_MODEL,
          }),
          glmModel: resolveTierModel({
            provider: "glm",
            tier: "strong",
            providerSpecificEnv: process.env.ANIMA_EMOTIONAL_MODEL_GLM,
            genericEnv: process.env.ANIMA_EMOTIONAL_MODEL,
          }),
          purpose:
            "Classificare il turno come verde/arancione/rosso quando il primo interprete non produce un esito chiaro.",
        }),
      },
      responseComposer: {
        ...resolveProviderNodeConfig({
          mode: "hybrid",
          groqModel: resolveTierModel({
            provider: "groq",
            tier: "strong",
            providerSpecificEnv: process.env.ANIMA_RESPONSE_MODEL_GROQ,
            genericEnv: process.env.ANIMA_RESPONSE_MODEL,
          }),
          glmModel: resolveTierModel({
            provider: "glm",
            tier: "strong",
            providerSpecificEnv: process.env.ANIMA_RESPONSE_MODEL_GLM,
            genericEnv: process.env.ANIMA_RESPONSE_MODEL,
          }),
          purpose:
            "Riformulare la risposta finale quando serve una forma piu naturale, estesa o personale.",
        }),
      },
    },
  },
  models: {
    guardrails: {
      mode: "deterministic",
      model: null,
    },
    intentExtractor: {
      mode: "deterministic",
      model: null,
    },
    router: {
      mode: "deterministic",
      model: null,
      defaultEventTypeResolver: "catalog_tokens" as const,
    },
    planUpdater: {
      mode: "deterministic",
      model: null,
    },
    executionDecider: {
      mode: "deterministic",
      model: null,
    },
    responder: {
      mode: "templated",
      model: null,
    },
    temporalReasoner: {
      mode: "hybrid",
      model: null,
    },
    speechToText: {
      mode: "hybrid",
      model: process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
    },
    mailComposer: {
      mode: "hybrid",
      model:
        LLM_RUNTIME_CONFIG.chat.provider === "glm"
          ? LLM_RUNTIME_CONFIG.chat.glm.model
          : LLM_RUNTIME_CONFIG.chat.groq.model,
      templateKey: "anima_generic_reminder",
    },
  },
  defaults: {
    recentDays: 7,
    futureDays: 7,
    genericFutureDays: 14,
    maxWindowDays: 60,
  },
  routing: {
    listLeadIns: [
      "mostra",
      "vorrei vedere",
      "voglio vedere",
      "vedere",
      "fammi vedere",
      "ricordi",
      "ricordami",
      "vedi",
      "elenca",
      "dammi",
      "manda",
      "mandami",
      "invia",
      "inviami",
      "quali sono",
      "aggiornami",
      "mi dici",
      "dimmi",
      "che eventi",
      "che cosa ho",
      "cosa ho",
      "cosa c e",
    ],
    greetingTerms: [
      "ciao",
      "buongiorno",
      "buonasera",
      "salve",
      "hey",
    ],
    genericFutureTerms: [
      "in futuro",
      "futuro",
      "prossimi giorni",
      "nei prossimi giorni",
      "eventi futuri",
      "prossimi eventi",
    ],
  },
  greeting: {
    enabled: true,
    welcomeOnlyOncePerSession: true,
  },
  texts: {
    welcomeCapabilities: [
      "dirti che tipi di eventi puoi gestire",
      "mostrarti eventi passati o futuri filtrati per periodo o tipo",
      "creare un evento e, se vuoi, mandarti anche un promemoria via email",
      "cercare anagrafiche come clienti, fornitori o altri tipi definiti dal gestionale",
      "preparare e creare nuove anagrafiche quando il tuo profilo lo consente",
      "leggerti i task attivi della sprint timeline e dirti cosa c'e da fare oggi",
    ],
    fallbackCapabilities: [
      "dirti i tipi di evento disponibili",
      "mostrarti eventi filtrati per periodo o tipo",
      "creare un evento accompagnandoti passo passo",
      "cercare anagrafiche e leggerti i campi che ti interessano",
      "accompagnarti nella creazione di una nuova anagrafica",
      "dirti task attivi, scadenze e priorita della sprint timeline",
    ],
    helpExamples: [
      {
        label: "lista mese",
        prompt: "mostrami i memo di questo mese",
      },
      {
        label: "lista futuro",
        prompt: "mi dici gli eventi dei prossimi 7 giorni?",
      },
      {
        label: "create base",
        prompt: "crea appuntamento domani alle 15",
      },
      {
        label: "create con mail",
        prompt: "crea appuntamento domani alle 15 e mandami anche una mail",
      },
      {
        label: "task oggi",
        prompt: "cosa ho da fare oggi?",
      },
      {
        label: "anagrafiche",
        prompt: "cerca il cliente Evolve nelle anagrafiche",
      },
      {
        label: "crea anagrafica",
        prompt: "crea un nuovo cliente chiamato Evolve SRL",
      },
      {
        label: "priorita task",
        prompt: "cosa dovrei fare per primo?",
      },
    ],
  },
  mail: {
    askReminderAfterCreate: true,
    digestDefaultMode: "future_or_past" as const,
    senderDisplayName: process.env.ANIMA_MAIL_SENDER_NAME?.trim() || "Anima",
    signatureName: process.env.ANIMA_MAIL_SIGNATURE_NAME?.trim() || "Anima",
    genericSubjectDefault:
      process.env.ANIMA_MAIL_GENERIC_SUBJECT?.trim() || "Messaggio da Anima",
  },
  channels: {
    internal: true,
    twilioWhatsapp: true,
    metaWhatsapp: true,
    twilioVoice: true,
    telegram: {
      enabled: false,
      identityMode: "telegram_user_id",
      phoneIsNotGuaranteed: true,
      botApiBaseUrl: "https://api.telegram.org",
      webhookStrategy: "adapter_placeholder",
      notes:
        "Telegram bot integra meglio user/chat id; il numero di telefono non e disponibile di default.",
    },
  },
} satisfies {
  todo: {
    moveToSharedConfig: boolean;
    extractTelegramWebhookAdapter: boolean;
    centralizeLlmProviderOutsideAnima: boolean;
  };
  llm: {
    provider: "groq" | "glm";
    providers: {
      groq: {
        model: string;
        baseUrl: string;
      };
      glm: {
        model: string;
        baseUrl: string;
        enableThinking: boolean;
      };
    };
    roleDefaults: {
      groq: {
        fast: string;
        strong: string;
        premium: string;
      };
      glm: {
        fast: string;
        strong: string;
        premium: string;
      };
    };
  };
  execution: {
    coreDecisionMode: "deterministic";
    defaultReplyMode: "templated";
    notes: string[];
    llmActivatedSteps: {
      mailComposer: {
        provider: "groq" | "glm";
        model: string | null;
        variants: AnimaProviderModelVariants;
        purpose: string;
        file: string;
      };
      legacyMetaWhatsappRouter: {
        provider: "groq" | "glm";
        model: string | null;
        variants: AnimaProviderModelVariants;
        purpose: string;
        file: string;
      };
      legacyMetaWhatsappChat: {
        provider: "groq" | "glm";
        model: string | null;
        variants: AnimaProviderModelVariants;
        purpose: string;
        file: string;
      };
      speechToText: {
        provider: "groq";
        model: string | null;
        variants: AnimaProviderModelVariants;
        purpose: string;
        file: string;
      };
    };
  };
  targetRuntime: {
    enabled: boolean;
    responseStyle: {
      defaultMode: "functional";
      allowExtendedMode: boolean;
      allowFunctionalMode: boolean;
      uiTogglePlanned: boolean;
    };
    memory: {
      shortTermEnabled: boolean;
      longTermEnabled: boolean;
      summarizeAfterEachTurn: boolean;
      consolidateOlderFacts: boolean;
      pruneIrrelevantFacts: boolean;
    };
    checkpoints: string[];
    states: {
      operationLifecycle: string[];
      guardrailColors: string[];
    };
    models: {
      operationSwitcher: AnimaLlmNodeRuntimeConfig;
      senseInterpreter: AnimaLlmNodeRuntimeConfig;
      operationRouter: AnimaLlmNodeRuntimeConfig;
      operationContextFiller: AnimaLlmNodeRuntimeConfig;
      operationExecutor: AnimaLlmNodeRuntimeConfig;
      shortTermMemorySummarizer: AnimaLlmNodeRuntimeConfig;
      longTermMemoryConsolidator: AnimaLlmNodeRuntimeConfig;
      emotionalEvaluator: AnimaLlmNodeRuntimeConfig;
      responseComposer: AnimaLlmNodeRuntimeConfig;
    };
  };
  models: {
    guardrails: AnimaStepConfig;
    intentExtractor: AnimaStepConfig;
    router: AnimaStepConfig & {
      defaultEventTypeResolver: "catalog_tokens" | "includes";
    };
    planUpdater: AnimaStepConfig;
    executionDecider: AnimaStepConfig;
    responder: AnimaStepConfig;
    temporalReasoner: AnimaStepConfig;
    speechToText: AnimaStepConfig;
    mailComposer: AnimaStepConfig & {
      templateKey: string;
    };
  };
  defaults: {
    recentDays: number;
    futureDays: number;
    genericFutureDays: number;
    maxWindowDays: number;
  };
  routing: {
    listLeadIns: string[];
    greetingTerms: string[];
    genericFutureTerms: string[];
  };
  greeting: {
    enabled: boolean;
    welcomeOnlyOncePerSession: boolean;
  };
  texts: {
    welcomeCapabilities: string[];
    fallbackCapabilities: string[];
    helpExamples: AnimaHelpExample[];
  };
  mail: {
    askReminderAfterCreate: boolean;
    digestDefaultMode: "future_or_past";
    senderDisplayName: string;
    signatureName: string;
    genericSubjectDefault: string;
  };
  channels: {
    internal: boolean;
    twilioWhatsapp: boolean;
    metaWhatsapp: boolean;
    twilioVoice: boolean;
    telegram: {
      enabled: boolean;
      identityMode: "telegram_user_id";
      phoneIsNotGuaranteed: boolean;
      botApiBaseUrl: string;
      webhookStrategy: "adapter_placeholder";
      notes: string;
    };
  };
};
