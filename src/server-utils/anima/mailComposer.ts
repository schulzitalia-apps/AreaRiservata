// src/server-utils/anima/mailComposer.ts
import mongoose from "mongoose";
import MailTemplateModel from "@/server-utils/models/MailTemplate";
import { renderTemplate } from "@/server-utils/actions-engine/commonHelpers";
import {
  buildAnagraficaPack,
  type AnagraficaPack,
} from "@/server-utils/anagrafiche/anagraficaPack";
import {
  createRuntimeChatProvider,
  resolveRuntimeChatSelection,
  type ChatProviderKind,
} from "@/server-utils/llm";
import { ANIMA_PROMPTS_CONFIG } from "@/server-utils/anima/config/anima.prompts.config";
import type { AnimaLlmTraceStep } from "@/server-utils/anima/core/types";

type ComposeInput = {
  templateKey: string;

  currentVars?: Record<string, any>;

  anagrafica?: {
    typeSlug: string;
    id: string;
  };

  userGoal?: string;
  language?: "it" | "en";
};

type ComposeOutput = {
  ok: true;
  template: {
    key: string;
    name: string;
    subject: string;
    html: string;
  };
  suggestion: {
    vars: Record<string, any>;
    subjectOverride?: string;
    htmlOverride?: string;
  };
  rendered: {
    subject: string;
    html: string;
  };
};

const TECHNICAL_KEYS = new Set([
  "__meta",
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "owner",
  "visibility",
  "visibleTo",
]);

const { MONGODB_URI } = process.env;

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  if (!MONGODB_URI) return;
  await mongoose.connect(MONGODB_URI);
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

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeComposeValue(value: any, depth: number): any {
  if (depth < 0) return undefined;
  if (value == null) return undefined;

  if (["string", "number", "boolean"].includes(typeof value)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    return value;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => sanitizeComposeValue(item, depth - 1))
      .filter((item) => item !== undefined);
    return cleaned.length ? cleaned.slice(0, 6) : undefined;
  }

  if (!isPlainObject(value)) return undefined;

  const out: Record<string, any> = {};
  for (const key of Object.keys(value)) {
    if (TECHNICAL_KEYS.has(key)) continue;
    const cleaned = sanitizeComposeValue(value[key], depth - 1);
    if (cleaned !== undefined) out[key] = cleaned;
  }

  return Object.keys(out).length ? out : undefined;
}

function sanitizeComposeVars(vars?: Record<string, any>) {
  if (!vars || !isPlainObject(vars)) return {};
  return (sanitizeComposeValue(vars, 4) ?? {}) as Record<string, any>;
}

function sanitizeComposePack(pack: AnagraficaPack | null) {
  if (!pack) return null;

  const rootData = (sanitizeComposeValue(pack.root?.data, 3) ?? {}) as Record<string, any>;
  const related = (pack.related || [])
    .map((node) => ({
      typeSlug: node.typeSlug,
      id: node.id,
      data: (sanitizeComposeValue(node.data, 2) ?? {}) as Record<string, any>,
    }))
    .filter((node) => Object.keys(node.data).length > 0)
    .slice(0, 4);

  return {
    root: {
      typeSlug: pack.root.typeSlug,
      id: pack.root.id,
      data: rootData,
    },
    related,
    emails: (pack.emails || []).slice(0, 6),
  };
}

async function callLlmForDraft(args: {
  templateKey: string;
  templateSubject: string;
  templateHtml: string;
  currentVars?: Record<string, any>;
  anagraficaPack?: AnagraficaPack | null;
  userGoal?: string;
  language: "it" | "en";
  provider?: ChatProviderKind | null;
  model?: string | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}) {
  const selection = resolveRuntimeChatSelection({
    provider: args.provider,
    model: args.model,
  });
  const llm = createRuntimeChatProvider(selection.provider);

  const _legacySystem = `
Sei un assistente che compone EMAIL aziendali professionali.

Ricevi:
1) Un template email esistente (subject + html)
2) currentVars (JSON) opzionali
3) anagraficaPack (JSON) opzionale:
   - root:    { typeSlug, id, data }             // dati principali
   - related: [{ typeSlug, id, data }, ...]      // anagrafiche referenziate (sotto-categorie)
   - emails:  [ ... ]                            // email trovate/normalizzate (solo supporto)

⚠️ IMPORTANTISSIMO SUL CONTESTO:
- "data" di root e related contiene TUTTO il materiale utile disponibile.
- In particolare: data.__meta contiene eventuali intestazioni/titoli/label e altri campi top-level del documento.
- Se trovi campi come "intestazione", "titolo", "nome", "ragioneSociale", ecc., interpretali come etichette/heading.

Obiettivo:
- Genera un SUBJECT e un HTML NUOVI e sensati usando SOLO i dati forniti (template + currentVars + anagraficaPack).
- NON inventare info non presenti: se manca un dato, evita o usa frasi neutre.
- NON incollare JSON/oggetti grezzi nell’email: riscrivi i dati in modo leggibile (frasi o elenco puntato).
- Mantieni un tono coerente con l’obiettivo utente (userGoal), professionale e concreto.
- Se userGoal è vuoto, fai una bozza “standard” utile, chiara e completa.
- Lingua output: ${args.language}

Vincoli output:
- Devi rispondere SOLO con un JSON SU UNA SOLA RIGA (niente testo prima/dopo).
- Non usare markdown nel JSON.
- L'HTML deve essere SOLO contenuto del body (no doctype, no html/head).

Schema consentito:
{"subject":"...","html":"...","vars":{...}}

Campi:
- subject: stringa finale
- html: corpo HTML finale
- vars: (opzionale) oggetto di variabili utili (anche vuoto), senza dati inventati.
`.trim();
  const system = ANIMA_PROMPTS_CONFIG.nodes.mailComposer.buildSystemPrompt({
    language: args.language,
  });

  const payload = {
    templateKey: args.templateKey,
    template: {
      subject: args.templateSubject,
      html: args.templateHtml,
    },
    currentVars: sanitizeComposeVars(args.currentVars),
    anagraficaPack: sanitizeComposePack(args.anagraficaPack ?? null),
    userGoal: args.userGoal ?? "",
  };

  try {
    const completion = await llm.chat({
      model: selection.model,
      temperature: ANIMA_PROMPTS_CONFIG.nodes.mailComposer.temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const raw = completion.content;

    const jsonStr = extractFirstJsonObject(raw);
    if (!jsonStr) throw new Error("MAIL_COMPOSER_OUTPUT_NOT_JSON");

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error("MAIL_COMPOSER_OUTPUT_NOT_JSON");
    }

    const subject = typeof parsed?.subject === "string" ? parsed.subject.trim() : "";
    const html = typeof parsed?.html === "string" ? parsed.html.trim() : "";
    if (!subject || !html) throw new Error("MAIL_COMPOSER_OUTPUT_SCHEMA_INVALID");

    const vars =
      parsed?.vars && typeof parsed.vars === "object" && !Array.isArray(parsed.vars)
        ? (parsed.vars as Record<string, any>)
        : {};

    args.traceCollector?.({
      id: `mail-composer-${Date.now()}`,
      step: "mailComposer",
      title: "Mail Composer",
      reason: "Comporre subject e HTML finali della mail.",
      provider: selection.provider,
      model: selection.model,
      usage: completion.usage ?? null,
      purpose: "Comporre subject e HTML delle email di Anima.",
      systemPrompt: system,
      input: payload,
      rawResponse: raw,
      parsedResponse: { subject, html, vars },
      status: "success",
      error: null,
    });

    return { subject, html, vars, provider: selection.provider };
  } catch (error: any) {
    args.traceCollector?.({
      id: `mail-composer-${Date.now()}`,
      step: "mailComposer",
      title: "Mail Composer",
      reason: "Comporre subject e HTML finali della mail.",
      provider: selection.provider,
      model: selection.model,
      usage: null,
      purpose: "Comporre subject e HTML delle email di Anima.",
      systemPrompt: system,
      input: payload,
      rawResponse: null,
      status: "failed",
      error: String(error?.message ?? "MAIL_COMPOSER_FAILED"),
    });
    throw error;
  }
}

export async function composeMailWithLlm(
  input: ComposeInput & {
    provider?: ChatProviderKind | null;
    model?: string | null;
    traceCollector?: (step: AnimaLlmTraceStep) => void;
  }
): Promise<ComposeOutput & { provider: ChatProviderKind }> {
  await ensureDb();
  const runtimeSelection = resolveRuntimeChatSelection({
    provider: input.provider,
    model: input.model,
  });

  const template = await MailTemplateModel.findOne({
    key: input.templateKey,
    enabled: true,
  }).lean();

  if (!template) throw new Error("TEMPLATE_NOT_FOUND_OR_DISABLED");

  const baseVars = input.currentVars ?? {};

  // ✅ pack anagrafica (root + reference + emails)
  let anagraficaPack: AnagraficaPack | null = null;
  if (input.anagrafica?.typeSlug && input.anagrafica?.id) {
    anagraficaPack = await buildAnagraficaPack(input.anagrafica.typeSlug, input.anagrafica.id);
  }

  // ✅ 1) prova con Groq
  try {
    const draft = await callLlmForDraft({
      templateKey: template.key,
      templateSubject: template.subject,
      templateHtml: template.html,
      currentVars: baseVars,
      anagraficaPack,
      userGoal: input.userGoal,
      language: input.language ?? "it",
      provider: input.provider,
      model: input.model,
      traceCollector: input.traceCollector,
    });

    const mergedSuggestionVars = { ...baseVars, ...(draft.vars || {}) };

    return {
      ok: true,
      template: {
        key: template.key,
        name: template.name,
        subject: template.subject,
        html: template.html,
      },
      suggestion: {
        vars: mergedSuggestionVars,
        subjectOverride: draft.subject,
        htmlOverride: draft.html,
      },
      rendered: {
        subject: draft.subject,
        html: draft.html,
      },
      provider: draft.provider,
    };
  } catch (e) {
    // ✅ 2) fallback: renderTemplate
    const subjectTpl = template.subject;
    const renderedSubject = renderTemplate(subjectTpl, baseVars) || subjectTpl;
    const renderedHtml = renderTemplate(template.html, baseVars) || template.html;

    return {
      ok: true,
      template: {
        key: template.key,
        name: template.name,
        subject: template.subject,
        html: template.html,
      },
      suggestion: {
        vars: baseVars,
      },
      rendered: {
        subject: renderedSubject,
        html: renderedHtml,
      },
      provider: runtimeSelection.provider,
    };
  }
}

export const composeMailWithGroq = composeMailWithLlm;
