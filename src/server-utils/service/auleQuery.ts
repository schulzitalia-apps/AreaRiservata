import mongoose from "mongoose";
import { connectToDatabase } from "../lib/mongoose-connection";
import { getAulaModel } from "../models/aule.factory";
import { getAulaDef } from "@/config/aule.registry";

// Security ACL
import { buildBasicAccessFilter } from "@/server-utils/access/access-engine";
import type { AuthContext } from "@/server-utils/lib/auth-context";

/* ------------------------------ TIPI DI DOMINIO ----------------------------- */

export type AulaPreview = {
  id: string;
  tipo: string;                // slug aula (es. "corsi-atleti")
  label: string;               // label dal config / dati
  anagraficaType: string;      // slug anagrafica collegata
  numeroPartecipanti: number;
  ownerName?: string;
  visibilityRole?: string | null;
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

export type AulaPartecipanteDetail = {
  anagraficaId: string;
  joinedAt: string;
  dati: Record<string, any>;
};

export type AulaDetail = AulaPreview & {
  campi: Record<string, any>;
  partecipanti: AulaPartecipanteDetail[];
  maestri: { id: string; name: string }[];
  attachments?: AttachmentView[];
};

/* ------------------------------ LIST / PREVIEW ------------------------------ */

export type ListAuleParams = {
  type: string;
  query?: string;
  limit?: number;
  docType?: string;
  visibilityRole?: string;
  page?: number;
  pageSize?: number;

  auth: AuthContext; // 👈 come sulle anagrafiche
};

export async function listAuleByType({
                                       type,
                                       query,
                                       limit = 100,
                                       docType,
                                       visibilityRole,
                                       page,
                                       pageSize,
                                       auth,
                                     }: ListAuleParams): Promise<{ items: AulaPreview[]; total: number }> {
  await connectToDatabase();

  const def = getAulaDef(type);
  const Model = getAulaModel(type);

  const conditions: any[] = [{ tipoSlug: type }];

  // ricerca testo sui campi di preview (dati.*)
  if (query) {
    const q = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    conditions.push({
      $or: def.preview.searchIn.map((k) => ({ [`dati.${k}`]: q })),
    });
  }

  // filtro per tipo documento allegato
  if (docType) conditions.push({ "attachments.type": docType });

  // filtro per visibilityRole esplicita
  if (visibilityRole) conditions.push({ visibilityRole });

  const baseFilter =
    conditions.length > 0 ? ({ $and: conditions } as any) : ({} as any);

  // 🔐 ACL centralizzata (owner / visibilityRole)
  const accessFilter = buildBasicAccessFilter<any>(auth);

  const combined: any[] = [];
  if (baseFilter && Object.keys(baseFilter).length) combined.push(baseFilter);
  if (accessFilter && Object.keys(accessFilter).length)
    combined.push(accessFilter);

  const filter =
    combined.length > 1
      ? ({ $and: combined } as any)
      : combined[0] || baseFilter || {};

  // paginazione
  const safePageSize = Math.min(pageSize ?? limit ?? 100, 200);
  const safePage = page && page > 0 ? page : 1;
  const skip = (safePage - 1) * safePageSize;

  const [docs, total] = await Promise.all([
    Model.find(filter)
      .populate("owner", "name")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safePageSize)
      .lean(),
    Model.countDocuments(filter),
  ]);

  const items: AulaPreview[] = docs.map((m: any) => ({
    id: String(m._id),
    tipo: def.slug,
    label: m.dati?.[def.preview.title[0]] ?? "(senza titolo)",
    anagraficaType: def.anagraficaSlug,
    numeroPartecipanti: m.partecipanti?.length ?? 0,
    ownerName: (m.owner as any)?.name ?? undefined,
    visibilityRole: m.visibilityRole ?? null,
  }));

  return { items, total };
}

/* ------------------------------ HELPER DETTAGLIO ---------------------------- */

function toAulaDetailFromDoc(
  type: string,
  doc: any,
  attachments?: AttachmentView[],
): AulaDetail {
  const def = getAulaDef(type);
  const labelKey = def.preview.title[0];

  const label = doc.dati?.[labelKey] ?? "(senza titolo)";

  return {
    id: String(doc._id),
    tipo: def.slug,
    label,
    anagraficaType: def.anagraficaSlug,
    numeroPartecipanti: doc.partecipanti?.length ?? 0,
    ownerName: (doc.owner as any)?.name ?? undefined,
    visibilityRole: doc.visibilityRole ?? null,
    campi: doc.dati ?? {},
    partecipanti: (doc.partecipanti ?? []).map((p: any) => ({
      anagraficaId: String(p.anagraficaId),
      joinedAt: p.joinedAt
        ? new Date(p.joinedAt).toISOString()
        : new Date().toISOString(),
      dati: p.dati ?? {},
    })),
    maestri: [] as { id: string; name: string }[],
    attachments,
  };
}

/* ----------------------------------- CREATE --------------------------------- */

export async function createAula(params: {
  type: string;
  ownerId: string;
  campi: Record<string, any>;
  partecipanti?: AulaPartecipanteDetail[];
  visibilityRole?: string | null;
}): Promise<AulaDetail> {
  const { type, ownerId, campi, partecipanti = [], visibilityRole } = params;

  await connectToDatabase();
  const Model = getAulaModel(type);

  const owner = new mongoose.Types.ObjectId(ownerId);

  const partecipantiDocs = partecipanti.map((p) => ({
    anagraficaId: new mongoose.Types.ObjectId(p.anagraficaId),
    joinedAt: p.joinedAt ? new Date(p.joinedAt) : new Date(),
    dati: p.dati ?? {},
  }));

  const created = await Model.create({
    tipoSlug: type,
    dati: campi,
    partecipanti: partecipantiDocs,
    visibilityRole: visibilityRole ?? null,
    owner,
    createdBy: owner,
    updatedBy: owner,
  });

  const doc = created.toObject();

  // appena creata non ha attachments, quindi []
  return toAulaDetailFromDoc(type, doc, []);
}

/* --------------------------------- GET BY ID -------------------------------- */

export async function getAulaById(params: {
  type: string;
  id: string;
}): Promise<AulaDetail | null> {
  const { type, id } = params;

  await connectToDatabase();
  const Model = getAulaModel(type);

  const raw = await Model.findById(id)
    .populate("owner", "name")
    .lean();
  if (!raw) return null;

  // join documents per attachments (speculare alle anagrafiche)
  const attList = (raw.attachments ?? []) as any[];
  const docIds = attList
    .map((a) => a?.documentId)
    .filter(Boolean)
    .map((x) => {
      try {
        return typeof x === "string"
          ? new mongoose.Types.ObjectId(x)
          : x;
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
        updatedAt: d.updatedAt
          ? new Date(d.updatedAt).toISOString()
          : null,
        visibility: d.visibility ?? null,
      },
    ]),
  );

  const attachments: AttachmentView[] = attList.map((a: any) => {
    const idStr = String(a.documentId);
    return {
      _id: String(a._id),
      type: a.type,
      uploadedAt: a.uploadedAt
        ? new Date(a.uploadedAt).toISOString()
        : null,
      documentId: idStr,
      document: docMap.get(idStr) ?? null,
      note: a.note ?? null,
    };
  });

  return toAulaDetailFromDoc(type, raw, attachments);
}

/* ----------------------------------- UPDATE --------------------------------- */

export async function updateAula(params: {
  type: string;
  id: string;
  updatedById: string;
  campi?: Record<string, any>;
  partecipanti?: AulaPartecipanteDetail[];
  visibilityRole?: string | null;
}): Promise<AulaDetail | null> {
  const { type, id, updatedById, campi, partecipanti = [], visibilityRole } =
    params;

  await connectToDatabase();
  const Model = getAulaModel(type);

  const partecipantiDocs = partecipanti.map((p) => ({
    anagraficaId: new mongoose.Types.ObjectId(p.anagraficaId),
    joinedAt: p.joinedAt ? new Date(p.joinedAt) : new Date(),
    dati: p.dati ?? {},
  }));

  const update: any = {
    updatedBy: new mongoose.Types.ObjectId(updatedById),
  };
  if (campi && typeof campi === "object") update.dati = campi;
  update.partecipanti = partecipantiDocs;
  if (typeof visibilityRole !== "undefined") {
    update.visibilityRole = visibilityRole;
  }

  const updated = await Model.findByIdAndUpdate(id, update, {
    new: true,
  })
    .populate("owner", "name")
    .lean();

  if (!updated) return null;

  // NB: per coerenza con anagrafica, qui non facciamo join dei documenti,
  // se vuoi puoi fare come getAulaById, ma spesso nel PUT non serve.
  return toAulaDetailFromDoc(type, updated);
}

/* ----------------------------------- DELETE --------------------------------- */

export async function deleteAula(params: {
  type: string;
  id: string;
}): Promise<{ ok: boolean }> {
  const { type, id } = params;

  if (!mongoose.isValidObjectId(id)) {
    throw new Error("INVALID_ID");
  }

  await connectToDatabase();
  const Model = getAulaModel(type);

  const res = await Model.findByIdAndDelete(id).lean();
  return { ok: !!res };
}

/* -------------------------- ATTACHMENT: ADD / REMOVE ------------------------ */

export async function addAttachmentToAula(params: {
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
  const Model = getAulaModel(type);

  await Model.findByIdAndUpdate(id, {
    $push: {
      attachments: {
        type: attachment.type,
        documentId: attachment.documentId,
        uploadedAt: attachment.uploadedAt ?? new Date(),
        note: attachment.note ?? null,
      },
    },
    $set: { updatedBy: new mongoose.Types.ObjectId(updatedById) },
  });
}

export async function removeAttachmentFromAula(params: {
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
  const Model = getAulaModel(type);

  const doc: any = await Model.findById(id);
  if (!doc) return null;

  const att: any = (doc.attachments as any[]).find(
    (a: any) => String(a._id) === String(attachmentId),
  );
  if (!att) return null;

  await Model.findByIdAndUpdate(id, {
    $pull: { attachments: { _id: att._id } },
    $set: { updatedBy: new mongoose.Types.ObjectId(updatedById) },
  });

  return {
    id: String(att._id),
    documentId: String(att.documentId),
    type: att.type as string,
  };
}
