import mongoose, { Types } from "mongoose";

import ActionMailRuleModel from "@/server-utils/models/ActionMailRule";
import { sendEmail } from "@/server-utils/mail/send-mail";

import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { isReferenceField } from "@/config/anagrafiche.fields.catalog";

import { renderTemplate } from "@/server-utils/actions-engine/commonHelpers";

type Scope = "ANAGRAFICA" | "AULA";

type AulaPartecipanteLite = {
  anagraficaType: string;
  anagraficaId: string;
  role?: string | null;
  status?: string | null;
  quantity?: number | null;
  note?: string | null;
};

export type AutoActionEmailHookParams = {
  scope: Scope;
  actionId: string;

  /**
   * Contesto minimo per risolvere destinatari.
   * - ANAGRAFICA: type/id + data
   * - AULA: lista partecipanti (lite) + data aula se serve nei template
   */
  anagrafica?: {
    anagraficaType: string;
    anagraficaId: string;
    data: Record<string, any>;
  };

  aula?: {
    aulaType: string;
    aulaId: string;
    data: Record<string, any>;
    partecipanti?: AulaPartecipanteLite[];
  };

  /**
   * Contesto template (quello che già usi per title/descrizione evento).
   * Ti conviene passare LO STESSO oggetto che usi in buildEventoData...
   */
  templateCtx: Record<string, any>;
};

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) return; // se la connessione la gestisci già altrove
  await mongoose.connect(uri);
}

function isValidEmail(x: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim());
}

function normalizeEmail(x: string) {
  return x.trim().toLowerCase();
}

function asObjectIdMaybe(id: any) {
  if (id instanceof Types.ObjectId) return id;
  if (typeof id === "string" && Types.ObjectId.isValid(id))
    return new Types.ObjectId(id);
  return id;
}

/**
 * I campi dinamici delle anagrafiche stanno in doc.data (o doc.dati).
 * Questa funzione normalizza.
 */
function getDocData(doc: any): Record<string, any> {
  if (doc?.data && typeof doc.data === "object") return doc.data;
  if (doc?.dati && typeof doc.dati === "object") return doc.dati;
  // fallback: non dovrebbe servire, ma non rompe nulla
  return doc ?? {};
}

function extractEmailsFromDoc(docOrData: any, emailFieldKeys: string[]) {
  const out: string[] = [];
  for (const k of emailFieldKeys) {
    const v = docOrData?.[k];
    if (typeof v === "string" && v.trim()) out.push(v);
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim()) out.push(item);
      }
    }
  }
  return out;
}

async function loadAnagraficaDoc(anagraficaType: string, anagraficaId: string) {
  const def = getAnagraficaDef(anagraficaType);

  // db può essere undefined -> se non pronta, non blocchiamo
  const db = mongoose.connection.db;
  if (!db) return null;

  const coll = db.collection(def.collection);
  const _id = asObjectIdMaybe(anagraficaId);
  return await coll.findOne({ _id });
}

function getEmailFieldKeysForAnagraficaType(anagraficaType: string) {
  const def = getAnagraficaDef(anagraficaType);

  const keys: string[] = [];
  for (const [k, fieldDef] of Object.entries(def.fields)) {
    if ((fieldDef as any)?.type === "email") keys.push(k);
  }
  return keys;
}

function extractRefIds(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === "string") return raw.trim() ? [raw.trim()] : [];
  if (raw instanceof Types.ObjectId) return [raw.toString()];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (x instanceof Types.ObjectId ? x.toString() : String(x)))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [String(raw)].map((s) => s.trim()).filter(Boolean);
}

/**
 * Extra: segue i campi reference -> anagrafica, se presenti nel tipo.
 * Esempio: preventivi.clientePreventivo -> clienti
 *
 * Nota: legge SEMPRE dal "data" del targetDoc.
 */
async function resolveEmailsFromReferences(
  anagraficaType: string,
  data: Record<string, any>,
) {
  const def = getAnagraficaDef(anagraficaType);
  const out: string[] = [];

  for (const [k, fieldDef] of Object.entries(def.fields)) {
    if (!isReferenceField(fieldDef as any)) continue;

    const ref = (fieldDef as any).reference;
    if (!ref || ref.kind !== "anagrafica") continue;

    const rawVal = data?.[k];
    const refIds = extractRefIds(rawVal);
    if (!refIds.length) continue;

    for (const refId of refIds) {
      try {
        const targetDoc = await loadAnagraficaDoc(
          String(ref.targetSlug),
          String(refId),
        );
        if (!targetDoc) continue;

        const targetData = getDocData(targetDoc);

        const targetEmailKeys = getEmailFieldKeysForAnagraficaType(
          String(ref.targetSlug),
        );

        out.push(...extractEmailsFromDoc(targetData, targetEmailKeys));
      } catch {
        // silent: una reference rotta non deve bloccare il salvataggio
      }
    }
  }

  return out;
}

export async function maybeSendEmailsForAutoAction(
  params: AutoActionEmailHookParams,
) {
  await ensureDb();

  const rule = await ActionMailRuleModel.findOne({
    actionId: params.actionId,
  }).lean();

  if (!rule || !rule.enabled) return;

  // Per ora: solo invio immediato (la routine futura gestirà ALLA_DATA_EVENTO)
  if (rule.sendMode === "ALLA_DATA_EVENTO") return;

  const recipients = new Set<string>();

  // 1) Destinatari: ANAGRAFICA
  if (params.scope === "ANAGRAFICA" && params.anagrafica) {
    const { anagraficaType, data } = params.anagrafica;

    // a) email fields diretti nel data (qui già OK)
    const emailKeys = getEmailFieldKeysForAnagraficaType(anagraficaType);
    const direct = extractEmailsFromDoc(data, emailKeys);
    for (const e of direct) {
      if (isValidEmail(e)) recipients.add(normalizeEmail(e));
    }

    // b) email da reference (FIX: targetDoc.data)
    const refs = await resolveEmailsFromReferences(anagraficaType, data);
    for (const e of refs) {
      if (isValidEmail(e)) recipients.add(normalizeEmail(e));
    }
  }

  // 2) Destinatari: AULA (tutti i partecipanti)
  if (params.scope === "AULA" && params.aula?.partecipanti?.length) {
    for (const p of params.aula.partecipanti) {
      try {
        const doc = await loadAnagraficaDoc(p.anagraficaType, p.anagraficaId);
        if (!doc) continue;

        const data = getDocData(doc);

        const emailKeys = getEmailFieldKeysForAnagraficaType(p.anagraficaType);
        const emails = extractEmailsFromDoc(data, emailKeys);
        for (const e of emails) {
          if (isValidEmail(e)) recipients.add(normalizeEmail(e));
        }
      } catch {
        // silent
      }
    }
  }

  const to = Array.from(recipients);
  if (!to.length) return;

  // 3) Template
  const subjectTemplate =
    (rule.subjectTemplate && String(rule.subjectTemplate).trim()) ||
    "Notifica automatica: {{actionId}}";

  const htmlTemplate =
    (rule.htmlTemplate && String(rule.htmlTemplate).trim()) ||
    `<p>Ciao,</p><p>è stata eseguita un'azione automatica: <b>{{actionId}}</b>.</p>`;

  const mergedCtx = {
    ...params.templateCtx,
    actionId: params.actionId,
    scope: params.scope,
  };

  const subject =
    renderTemplate(subjectTemplate, mergedCtx) || "Notifica automatica";
  const html = renderTemplate(htmlTemplate, mergedCtx) || htmlTemplate;

  // ✅ NON bloccare il salvataggio se l’email fallisce
  try {
    await sendEmail({
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[AUTO-ACTIONS EMAIL] sendEmail failed:", err);
  }
}
