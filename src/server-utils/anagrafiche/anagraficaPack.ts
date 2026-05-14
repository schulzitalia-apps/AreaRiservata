import mongoose, { Types } from "mongoose";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { isReferenceField } from "@/config/anagrafiche.fields.catalog";

export type AnagraficaNode = {
  typeSlug: string;
  id: string;
  data: Record<string, any>;
};

export type AnagraficaPack = {
  root: AnagraficaNode;
  related: AnagraficaNode[];
  emails: string[];
};

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
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

function getDocData(doc: any): Record<string, any> {
  const data =
    (doc?.data && typeof doc.data === "object" && doc.data) ||
    (doc?.dati && typeof doc.dati === "object" && doc.dati) ||
    {};

  const meta: Record<string, any> = { ...(doc ?? {}) };
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

function getFieldValue(data: any, key: string) {
  if (data && typeof data === "object") {
    if (data[key] !== undefined) return data[key];
    if (data.__meta && typeof data.__meta === "object" && data.__meta[key] !== undefined) {
      return data.__meta[key];
    }
  }
  return undefined;
}

function extractEmailsFromDoc(docOrData: any, emailFieldKeys: string[]) {
  const out: string[] = [];
  for (const key of emailFieldKeys) {
    const value = getFieldValue(docOrData, key);

    if (typeof value === "string" && value.trim()) out.push(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) out.push(item);
      }
    }
  }
  return out;
}

function getEmailFieldKeysForAnagraficaType(anagraficaType: string) {
  const def = getAnagraficaDef(anagraficaType);
  const keys: string[] = [];
  for (const [key, fieldDef] of Object.entries(def.fields)) {
    if ((fieldDef as any)?.type === "email") keys.push(key);
  }
  return keys;
}

function extractRefIds(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === "string") return raw.trim() ? [raw.trim()] : [];
  if (raw instanceof Types.ObjectId) return [raw.toString()];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (item instanceof Types.ObjectId ? item.toString() : String(item)))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [String(raw)].map((item) => item.trim()).filter(Boolean);
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

function collectEmailsForType(typeSlug: string, data: Record<string, any>, emails: Set<string>) {
  const emailKeys = getEmailFieldKeysForAnagraficaType(typeSlug);
  for (const email of extractEmailsFromDoc(data, emailKeys)) {
    if (isValidEmail(email)) emails.add(normalizeEmail(email));
  }
}

async function collectRelatedChain(args: {
  typeSlug: string;
  sourceData: Record<string, any>;
  related: AnagraficaNode[];
  emails: Set<string>;
  visited: Set<string>;
  depth: number;
}) {
  if (args.depth <= 0) return;

  const def = getAnagraficaDef(args.typeSlug);

  for (const [key, fieldDef] of Object.entries(def.fields)) {
    if (!isReferenceField(fieldDef as any)) continue;

    const ref = (fieldDef as any).reference;
    if (!ref || ref.kind !== "anagrafica") continue;

    const rawRefValue = getFieldValue(args.sourceData, key);
    const refIds = extractRefIds(rawRefValue);
    if (!refIds.length) continue;

    for (const refId of refIds) {
      try {
        const targetSlug = String(ref.targetSlug || "").trim();
        const targetId = String(refId || "").trim();
        if (!targetSlug || !targetId) continue;

        const visitKey = `${targetSlug}:${targetId}`;
        if (args.visited.has(visitKey)) continue;
        args.visited.add(visitKey);

        const targetDoc = await loadAnagraficaDoc(targetSlug, targetId);
        if (!targetDoc) continue;

        const targetData = getDocData(targetDoc);
        args.related.push({ typeSlug: targetSlug, id: targetId, data: targetData });
        collectEmailsForType(targetSlug, targetData, args.emails);

        await collectRelatedChain({
          typeSlug: targetSlug,
          sourceData: targetData,
          related: args.related,
          emails: args.emails,
          visited: args.visited,
          depth: args.depth - 1,
        });
      } catch {
        // silent: a broken reference must not block the mail workflow
      }
    }
  }
}

export async function buildAnagraficaPack(typeSlug: string, id: string): Promise<AnagraficaPack | null> {
  const rootDoc = await loadAnagraficaDoc(typeSlug, id);
  if (!rootDoc) return null;

  const rootData = getDocData(rootDoc);
  const root: AnagraficaNode = { typeSlug, id, data: rootData };

  const related: AnagraficaNode[] = [];
  const emails = new Set<string>();
  const visited = new Set<string>([`${typeSlug}:${id}`]);

  collectEmailsForType(typeSlug, rootData, emails);

  await collectRelatedChain({
    typeSlug,
    sourceData: rootData,
    related,
    emails,
    visited,
    depth: 3,
  });

  return { root, related, emails: Array.from(emails) };
}
