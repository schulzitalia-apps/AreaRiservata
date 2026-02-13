// src/server-utils/anima/mailComposer.ts
import mongoose from "mongoose";
import MailTemplateModel from "@/server-utils/models/MailTemplate";
import { renderTemplate } from "@/server-utils/actions-engine/commonHelpers";
import {
  buildAnagraficaPack,
  type AnagraficaPack,
} from "@/server-utils/anagrafiche/anagraficaPack";

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

const { GROQ_API_KEY, GROQ_MODEL = "llama-3.1-8b-instant", MONGODB_URI } = process.env;

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

async function callGroqForDraft(args: {
  templateKey: string;
  templateSubject: string;
  templateHtml: string;
  currentVars?: Record<string, any>;
  anagraficaPack?: AnagraficaPack | null;
  userGoal?: string;
  language: "it" | "en";
}) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY mancante");

  const system = `
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

  const payload = {
    templateKey: args.templateKey,
    template: {
      subject: args.templateSubject,
      html: args.templateHtml,
    },
    currentVars: args.currentVars ?? {},
    anagraficaPack: args.anagraficaPack ?? null,
    userGoal: args.userGoal ?? "",
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`GROQ_ERROR_${res.status} (model=${GROQ_MODEL}): ${t || "request failed"}`);
  }

  const data: any = await res.json();
  const raw = String(data?.choices?.[0]?.message?.content ?? "").trim();

  const jsonStr = extractFirstJsonObject(raw);
  if (!jsonStr) throw new Error("GROQ_OUTPUT_NOT_JSON");

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("GROQ_OUTPUT_NOT_JSON");
  }

  const subject = typeof parsed?.subject === "string" ? parsed.subject.trim() : "";
  const html = typeof parsed?.html === "string" ? parsed.html.trim() : "";
  if (!subject || !html) throw new Error("GROQ_OUTPUT_SCHEMA_INVALID");

  const vars =
    parsed?.vars && typeof parsed.vars === "object" && !Array.isArray(parsed.vars)
      ? (parsed.vars as Record<string, any>)
      : {};

  return { subject, html, vars };
}

export async function composeMailWithGroq(input: ComposeInput): Promise<ComposeOutput> {
  await ensureDb();

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
    const draft = await callGroqForDraft({
      templateKey: template.key,
      templateSubject: template.subject,
      templateHtml: template.html,
      currentVars: baseVars,
      anagraficaPack,
      userGoal: input.userGoal,
      language: input.language ?? "it",
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
    };
  }
}
