// src/server-utils/service/anagraficaQuery.ts
import mongoose from "mongoose";
import { connectToDatabase } from "../../lib/mongoose-connection";
import { getAnagraficaModel } from "../../models/Anagrafiche/anagrafiche.factory";
import UserModel from "../../models/User";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import {
  FieldKey,
  isReferenceField,
} from "@/config/anagrafiche.fields.catalog";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

// Security ACL
import { buildMongoAccessFilter } from "@/server-utils/access/access-engine";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/* ------------------------------ TIPI DI DOMINIO ----------------------------- */

export type AnagraficaPreview = {
  id: string;
  data: Record<string, any>;
  displayName: string;
  subtitle: string | null;
  updatedAt: string;
  visibilityRoles?: string[]; // ✅ era visibilityRole
  ownerId?: string | null;
  ownerName?: string | null;
};

export type DocumentLight = {
  id: string;
  title: string | null;
  category: string | null;
  updatedAt?: string | null;
  visibility?: string | null;
};

export type AttachmentView = {
  _id: string;
  type: string;
  uploadedAt: string | null;
  documentId: string;
  document?: DocumentLight | null;
  note?: string | null;
};

export type AnagraficaFull = {
  id: string;
  data: Record<string, any>;
  visibilityRoles?: string[]; // ✅ era visibilityRole
  attachments?: AttachmentView[];
  createdAt?: string;
  updatedAt?: string;
};

export type ListAnagraficheParams = {
  type: string; // slug: "clienti", "conferme-ordine"
  query?: string;
  limit?: number;
  offset?: number;
  docType?: string;

  /**
   * Filtro dominio opzionale:
   * - se passato, restringe ai record che contengono QUEL ruolo/policy nell'array
   *   (semantica: array contains)
   */
  visibilityRole?: string; // lo lasciamo come input singolo per compatibilità API
  auth: AuthContext;
};

/* -------------------------- NORMALIZZAZIONE REFERENCE ------------------------ */
/**
 * Fix minimale per evitare che i reference dentro `data.*` diventino stringhe
 * dopo un PATCH/CREATE (data è Mixed => Mongoose non casta).
 *
 * - Per ogni campo definito come reference nel registry:
 *   - stringa ObjectId valida => ObjectId
 *   - array di stringhe => array di ObjectId
 *   - "" => null
 *
 * NB: non tocca campi non reference.
 */

function normalizeAnagraficaDataReferences(
  slug: AnagraficaTypeSlug,
  input: Record<string, any>,
): Record<string, any> {
  const def = getAnagraficaDef(slug);

  // copia shallow: basta per il nostro caso (valori scalari/array)
  const out: Record<string, any> = { ...(input || {}) };

  for (const [key, fieldDef] of Object.entries(def.fields as any)) {
    if (!fieldDef) continue;
    if (!isReferenceField(fieldDef as any)) continue;

    const cur = out[key];

    // vuoti => null
    if (cur === "" || cur === undefined) continue; // non forzare: se non arriva non lo inventiamo
    if (cur === null) continue;

    // reference singola
    if (typeof cur === "string") {
      if (mongoose.isValidObjectId(cur)) {
        out[key] = new mongoose.Types.ObjectId(cur);
      }
      continue;
    }

    // reference multipla (se mai presente come array)
    if (Array.isArray(cur)) {
      const casted = cur
        .map((v) => {
          if (v === "" || v === null || v === undefined) return null;
          if (v instanceof mongoose.Types.ObjectId) return v;
          if (typeof v === "string" && mongoose.isValidObjectId(v)) {
            return new mongoose.Types.ObjectId(v);
          }
          return null;
        })
        .filter(Boolean);

      out[key] = casted;
    }
  }

  return out;
}


/* ----------------------------------- CREATE --------------------------------- */

export async function createAnagrafica(params: {
  type: string;
  userId: string;
  data: Record<string, any>;
  visibilityRoles?: string[]; // ✅
}): Promise<{ id: string }> {
  const { type, userId, data, visibilityRoles } = params;

  await connectToDatabase();
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  // ✅ Fix: normalizza reference dentro data
  const normalizedData = normalizeAnagraficaDataReferences(slug, data || {});

  const owner = new mongoose.Types.ObjectId(userId);
  const created = await Model.create({
    data: normalizedData,
    visibilityRoles: visibilityRoles ?? [],
    owner,
    createdBy: owner,
    updatedBy: owner,
  });

  return { id: String(created._id) };
}

/* ------------------------------- GET BY ID (FULL) --------------------------- */

export async function getAnagraficaById(params: {
  type: string;
  id: string;
}): Promise<AnagraficaFull | null> {
  const { type, id } = params;

  await connectToDatabase();
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  const raw = await Model.findById(id).lean();
  if (!raw) return null;

  // join documents
  const attList = (raw.attachments ?? []) as any[];
  const docIds = attList
    .map((a) => a?.documentId)
    .filter(Boolean)
    .map((x) => {
      try {
        return typeof x === "string" ? new mongoose.Types.ObjectId(x) : x;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as mongoose.Types.ObjectId[];

  const docsColl = mongoose.connection.db!.collection("documents");
  const docs = docIds.length
    ? await docsColl
      .find(
        { _id: { $in: docIds } },
        {
          projection: {
            title: 1,
            category: 1,
            updatedAt: 1,
            visibility: 1,
          },
        },
      )
      .toArray()
    : [];

  const docMap = new Map<string, DocumentLight>(
    docs.map((d: any) => [
      String(d._id),
      {
        id: String(d._id),
        title: d.title ?? null,
        category: d.category ?? null,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
        visibility: d.visibility ?? null,
      },
    ]),
  );

  const attachments: AttachmentView[] = attList.map((a: any) => {
    const idStr = String(a.documentId);
    return {
      _id: String(a._id),
      type: a.type,
      uploadedAt: a.uploadedAt ? new Date(a.uploadedAt).toISOString() : null,
      documentId: idStr,
      document: docMap.get(idStr) ?? null,
      note: a.note ?? null,
    };
  });

  return {
    id: String(raw._id),
    data: raw.data || {},
    visibilityRoles: Array.isArray((raw as any).visibilityRoles) ? (raw as any).visibilityRoles : [],
    attachments,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
  };
}

/* ----------------------------------- UPDATE --------------------------------- */

export async function updateAnagrafica(params: {
  type: string;
  id: string;
  updatedById: string;
  data?: Record<string, any>;
  visibilityRoles?: string[]; // ✅
}): Promise<AnagraficaFull | null> {
  const { type, id, updatedById, data, visibilityRoles } = params;

  await connectToDatabase();
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  const update: any = { updatedBy: updatedById };

  if (data && typeof data === "object") {
    const existing = await Model.findById(id).select({ data: 1 }).lean<{ data?: any } | null>();
    if (!existing) return null;

    const merged = {
      ...(existing.data || {}),
      ...(data || {}),
    };

    update.data = normalizeAnagraficaDataReferences(slug, merged);
  }

  if (typeof visibilityRoles !== "undefined") update.visibilityRoles = visibilityRoles ?? [];

  const updated = await Model.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();

  if (!updated) return null;

  return {
    id: String(updated._id),
    data: updated.data || {},
    visibilityRoles: Array.isArray((updated as any).visibilityRoles) ? (updated as any).visibilityRoles : [],
    createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString() : undefined,
    updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : undefined,
  };
}

/* ----------------------------------- DELETE --------------------------------- */

export async function deleteAnagrafica(params: {
  type: string;
  id: string;
}): Promise<{ ok: boolean; id?: string }> {
  const { type, id } = params;

  if (!mongoose.isValidObjectId(id)) {
    throw new Error("INVALID_ID");
  }

  await connectToDatabase();
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  const deleted = await Model.findByIdAndDelete(id).lean();
  if (!deleted) {
    return { ok: false };
  }

  return { ok: true, id: String(deleted._id) };
}

/* -------------------------- ATTACHMENT: ADD / REMOVE ------------------------ */

export async function addAttachmentToAnagrafica(params: {
  type: string;
  id: string;
  attachment: {
    type: string;
    documentId: string;
    uploadedAt?: Date;
    note?: string | null;
  };
  updatedById: string;
}): Promise<void> {
  const { type, id, attachment, updatedById } = params;

  await connectToDatabase();
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  await Model.findByIdAndUpdate(id, {
    $push: {
      attachments: {
        type: attachment.type,
        documentId: attachment.documentId,
        uploadedAt: attachment.uploadedAt ?? new Date(),
        note: attachment.note ?? null,
      },
    },
    $set: { updatedBy: updatedById },
  });
}

export async function removeAttachmentFromAnagrafica(params: {
  type: string;
  id: string;
  attachmentId: string;
  updatedById: string;
}): Promise<{
  id: string;
  documentId: string;
  type: string;
} | null> {
  const { type, id, attachmentId, updatedById } = params;

  await connectToDatabase();
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  const doc: any = await Model.findById(id);
  if (!doc) return null;

  const att: any = (doc.attachments as any[]).find(
    (a: any) => String(a._id) === String(attachmentId),
  );
  if (!att) return null;

  await Model.findByIdAndUpdate(id, {
    $pull: { attachments: { _id: att._id } },
    $set: { updatedBy: updatedById },
  });

  return {
    id: String(att._id),
    documentId: String(att.documentId),
    type: att.type as string,
  };
}

/* ---------- PER LE REFERENCE INCROCIATE IN PREVIEW (field-values) ---------- */

export async function getAnagraficheFieldValuesByIds(params: {
  type: string;
  ids: string[];
  field: FieldKey | string;
}): Promise<Record<string, string | null>> {
  const { type, ids, field } = params;

  await connectToDatabase();
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  const objectIds = ids.filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));

  if (!objectIds.length) return {};

  const docs = await Model.find({ _id: { $in: objectIds } })
    .select({ _id: 1, [`data.${field}`]: 1 } as any)
    .lean();

  const out: Record<string, string | null> = {};

  for (const d of docs as any[]) {
    const idStr = String(d._id);
    const raw = d.data?.[field as string];

    out[idStr] =
      raw === undefined || raw === null || String(raw).trim() === ""
        ? null
        : String(raw);
  }

  return out;
}
