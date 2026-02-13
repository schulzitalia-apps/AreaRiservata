// src/server-utils/anagrafiche/anagraficaPack.ts
import mongoose, { Types } from "mongoose";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { isReferenceField } from "@/config/anagrafiche.fields.catalog";

export type AnagraficaNode = {
  typeSlug: string;
  id: string;

  /**
   * data contiene:
   * - i campi business (doc.data o doc.dati)
   * - + data.__meta con campi top-level utili (es. intestazione/titolo/label ecc.)
   */
  data: Record<string, any>;
};

export type AnagraficaPack = {
  root: AnagraficaNode;

  /** reference risolte (attualmente 1-hop dal root, come prima) */
  related: AnagraficaNode[];

  /** email uniche + normalizzate (supporto) */
  emails: string[];
};

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) return; // se la connessione la gestisci altrove
  await mongoose.connect(uri);
}

function isValidEmail(x: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x || "").trim());
}

function normalizeEmail(x: string) {
  return String(x || "").trim().toLowerCase();
}

function asObjectIdMaybe(id: any) {
  if (id instanceof Types.ObjectId) return id;
  if (typeof id === "string" && Types.ObjectId.isValid(id)) return new Types.ObjectId(id);
  return id;
}

/**
 * Normalizza doc.data / doc.dati e aggiunge meta top-level.
 * Serve proprio per quei casi in cui la "sottocategoria" ha intestazione/titolo a livello documento,
 * non dentro data/dati.
 */
function getDocData(doc: any): Record<string, any> {
  const data =
    (doc?.data && typeof doc.data === "object" && doc.data) ||
    (doc?.dati && typeof doc.dati === "object" && doc.dati) ||
    {};

  // Meta: tutto ciò che sta fuori da data/dati (spesso: intestazione, titolo, slug, ecc.)
  const meta: Record<string, any> = { ...(doc ?? {}) };

  // ripulisci campi tecnici e duplicazioni
  delete meta.data;
  delete meta.dati;
  delete meta._id;
  delete meta.__v;
  delete meta.createdAt;
  delete meta.updatedAt;

  return {
    ...data,
    __meta: meta,
  };
}

function getFieldValue(data: any, k: string) {
  // prova prima nel payload business, poi nel meta
  if (data && typeof data === "object") {
    if (data[k] !== undefined) return data[k];
    if (data.__meta && typeof data.__meta === "object" && data.__meta[k] !== undefined) return data.__meta[k];
  }
  return undefined;
}

function extractEmailsFromDoc(docOrData: any, emailFieldKeys: string[]) {
  const out: string[] = [];
  for (const k of emailFieldKeys) {
    const v = getFieldValue(docOrData, k);

    if (typeof v === "string" && v.trim()) out.push(v);

    if (Array.isArray(v)) {
      for (const item of v) if (typeof item === "string" && item.trim()) out.push(item);
    }
  }
  return out;
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

async function loadAnagraficaDoc(typeSlug: string, id: string) {
  await ensureDb();

  const db = mongoose.connection.db;
  if (!db) return null;

  const def = getAnagraficaDef(typeSlug);
  const coll = db.collection(def.collection);
  const _id = asObjectIdMaybe(id);

  return await coll.findOne({ _id });
}

/**
 * Costruisce un "pack" risolvendo:
 * - email dirette del root (campi type=email)
 * - email dei target delle reference (1-hop) (campi reference -> kind=anagrafica)
 * - related nodes (1-hop) per dare contesto extra all'AI (data del targetDoc + __meta)
 *
 * NB: Mantiene la logica 1-hop come ora: il tuo problema era che alcuni campi utili
 *     (es. intestazioni) stavano top-level e non finivano in data/dati.
 */
export async function buildAnagraficaPack(typeSlug: string, id: string): Promise<AnagraficaPack | null> {
  const rootDoc = await loadAnagraficaDoc(typeSlug, id);
  if (!rootDoc) return null;

  const rootData = getDocData(rootDoc);
  const root: AnagraficaNode = { typeSlug, id, data: rootData };

  const related: AnagraficaNode[] = [];
  const emails = new Set<string>();

  // a) email dirette root (schema-aware)
  const rootEmailKeys = getEmailFieldKeysForAnagraficaType(typeSlug);
  for (const e of extractEmailsFromDoc(rootData, rootEmailKeys)) {
    if (isValidEmail(e)) emails.add(normalizeEmail(e));
  }

  // b) email + data da reference (1-hop)
  const def = getAnagraficaDef(typeSlug);

  for (const [k, fieldDef] of Object.entries(def.fields)) {
    if (!isReferenceField(fieldDef as any)) continue;

    const ref = (fieldDef as any).reference;
    if (!ref || ref.kind !== "anagrafica") continue;

    // ✅ la reference potrebbe stare nel payload business o nel meta
    const rawRefValue = getFieldValue(rootData, k);
    const refIds = extractRefIds(rawRefValue);
    if (!refIds.length) continue;

    for (const refId of refIds) {
      try {
        const targetSlug = String(ref.targetSlug);
        const targetDoc = await loadAnagraficaDoc(targetSlug, String(refId));
        if (!targetDoc) continue;

        const targetData = getDocData(targetDoc);
        related.push({ typeSlug: targetSlug, id: String(refId), data: targetData });

        const targetEmailKeys = getEmailFieldKeysForAnagraficaType(targetSlug);
        for (const e of extractEmailsFromDoc(targetData, targetEmailKeys)) {
          if (isValidEmail(e)) emails.add(normalizeEmail(e));
        }
      } catch {
        // silent: reference rotta non deve bloccare
      }
    }
  }

  return { root, related, emails: Array.from(emails) };
}
