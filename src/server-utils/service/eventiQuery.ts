// src/server-utils/service/eventiQuery.ts
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/mongoose-connection";
import { getEventoModel } from "../models/eventi.factory";
import UserModel from "../models/User";
import { getEventoDef } from "@/config/eventi.registry";
import type { TimeKind, IEventoDoc } from "../models/evento.schema";

// ✅ per espansione “sottokey” via ACL anagrafiche
import { getAnagraficaModel } from "../models/Anagrafiche/anagrafiche.factory";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

// Security ACL
import {
  buildBasicAccessFilter,
  buildMongoAccessFilter,
  getRelevantAnagraficaSlugsForAuth,
} from "@/server-utils/access/access-engine";
import type { AuthContext } from "@/server-utils/lib/auth-context";

/* ------------------------------ TIPI DI DOMINIO ----------------------------- */

export type EventoPreview = {
  id: string;
  displayName: string;
  subtitle: string | null;
  timeKind: TimeKind;
  startAt?: string | null;
  endAt?: string | null;
  updatedAt: string;
  visibilityRole?: string | null;
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

export type EventoPartecipanteView = {
  anagraficaType: string;
  anagraficaId: string;
  role?: string | null;
  status?: string | null;
  quantity?: number | null;
  note?: string | null;
};

export type EventoGruppoView = {
  gruppoType: string;
  gruppoId: string;
};

export type EventoRecurrenceView = {
  rrule?: string | null;
  until?: string | null;
  count?: number | null;
  masterId?: string | null;
};

export type EventoFull = {
  id: string;
  data: Record<string, any>;
  timeKind: TimeKind;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: boolean;

  recurrence?: EventoRecurrenceView | null;
  gruppo?: EventoGruppoView | null;
  partecipanti: EventoPartecipanteView[];

  visibilityRole?: string | null;
  attachments?: AttachmentView[];

  createdAt?: string;
  updatedAt?: string;

  _autoEvent?: string | null;
};

/* ------------------------------ LIST / PREVIEW ------------------------------ */

export type ListEventiParams = {
  type: string;
  query?: string;
  limit?: number;
  visibilityRole?: string;

  timeFrom?: string;
  timeTo?: string;

  anagraficaFilter?: {
    anagraficaType: string;
    anagraficaId: string;
  };

  gruppoFilter?: {
    gruppoType: string;
    gruppoId: string;
  };

  page?: number;
  pageSize?: number;

  auth: AuthContext;
};

export async function listEventi({
                                   type,
                                   query,
                                   limit = 100,
                                   visibilityRole,
                                   timeFrom,
                                   timeTo,
                                   anagraficaFilter,
                                   gruppoFilter,
                                   page,
                                   pageSize,
                                   auth,
                                 }: ListEventiParams): Promise<{
  items: EventoPreview[];
  total: number;
}> {
  await connectToDatabase();

  const def = getEventoDef(type);
  const Model = getEventoModel(type);

  const conditions: any[] = [];

  // 🔎 testo su campi preview
  if (query) {
    const q = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    conditions.push({
      $or: def.preview.searchIn.map((k) => ({
        [`data.${k}`]: q,
      })),
    });
  }

  // filtro visibilità esplicita
  if (visibilityRole) conditions.push({ visibilityRole });

  // ⏱ filtro temporale
  if (timeFrom || timeTo) {
    const from = timeFrom ? new Date(timeFrom) : undefined;
    const to = timeTo ? new Date(timeTo) : undefined;

    const timeOr: any[] = [];

    if (from && to) {
      timeOr.push({
        $and: [{ startAt: { $lte: to } }, { endAt: { $gte: from } }],
      });
    }

    const rangeStart: any = {};
    if (from) rangeStart.$gte = from;
    if (to) rangeStart.$lte = to;
    if (Object.keys(rangeStart).length > 0) {
      timeOr.push({ startAt: rangeStart });
    }

    const rangeEnd: any = {};
    if (from) rangeEnd.$gte = from;
    if (to) rangeEnd.$lte = to;
    if (Object.keys(rangeEnd).length > 0) {
      timeOr.push({ endAt: rangeEnd });
    }

    if (timeOr.length > 0) {
      conditions.push({ $or: timeOr });
    }
  }

  // filtro per partecipante specifico (query param)
  if (anagraficaFilter?.anagraficaId && anagraficaFilter.anagraficaType) {
    conditions.push({
      partecipanti: {
        $elemMatch: {
          anagraficaType: anagraficaFilter.anagraficaType,
          anagraficaId: new mongoose.Types.ObjectId(anagraficaFilter.anagraficaId),
        },
      },
    });
  }

  // filtro per gruppo specifico
  if (gruppoFilter?.gruppoId && gruppoFilter.gruppoType) {
    conditions.push({
      "gruppo.gruppoType": gruppoFilter.gruppoType,
      "gruppo.gruppoId": new mongoose.Types.ObjectId(gruppoFilter.gruppoId),
    });
  }

  const baseFilter =
    conditions.length > 0 ? ({ $and: conditions } as any) : ({} as any);

  /* ------------------------------------------------------------------------ */
  /*  🔐 ACL EVENTI: owner/visibility + partecipanti visibili “come anagrafiche” */
  /*  (include sottokey byReference tramite buildMongoAccessFilter)            */
  /* ------------------------------------------------------------------------ */

  // 1) accesso base eventi
  const baseAccess = buildBasicAccessFilter<IEventoDoc>(auth);

  // 2) slugs anagrafiche “rilevanti” (dirette + quelle sbloccate da keyFilters)
  const relevantAnaSlugs = getRelevantAnagraficaSlugsForAuth(auth);

  // 3) per ogni slug: prendi gli ID anagrafiche visibili usando buildMongoAccessFilter
  //    (che include le sottokey)
  const participantOr: any[] = [];

  for (const slugStr of relevantAnaSlugs) {
    const slug = slugStr as AnagraficaTypeSlug;

    const AnaModel = getAnagraficaModel(slug);
    const anaAccess = buildMongoAccessFilter<any>(auth, slug) as unknown as mongoose.FilterQuery<any>;

    const docs = await AnaModel.find(anaAccess).select({ _id: 1 }).lean();
    const ids = docs.map((d: any) => d._id).filter(Boolean);

    if (!ids.length) continue;

    participantOr.push({
      partecipanti: {
        $elemMatch: {
          anagraficaType: slugStr,
          anagraficaId: { $in: ids },
        },
      },
    });
  }

  // accessFilter finale: OR(baseAccess, partecipanti-in-ids)
  let accessFilter: any = baseAccess;

  if (participantOr.length) {
    const orParts: any[] = [];
    if (accessFilter && Object.keys(accessFilter).length) orParts.push(accessFilter);
    orParts.push(...participantOr);

    accessFilter = orParts.length > 1 ? ({ $or: orParts } as any) : orParts[0];
  }

  // combina baseFilter + accessFilter
  const combined: any[] = [];
  if (baseFilter && Object.keys(baseFilter).length) combined.push(baseFilter);
  if (accessFilter && Object.keys(accessFilter).length) combined.push(accessFilter);

  const filter =
    combined.length > 1
      ? ({ $and: combined } as any)
      : combined[0] || baseFilter || {};

  // paginazione
  const safePageSize = Math.min(pageSize ?? limit ?? 100, 200);
  const safePage = page && page > 0 ? page : 1;
  const skip = (safePage - 1) * safePageSize;

  const [docsOut, total] = await Promise.all([
    Model.find(filter)
      .select({
        data: 1,
        owner: 1,
        updatedAt: 1,
        visibilityRole: 1,
        timeKind: 1,
        startAt: 1,
        endAt: 1,
        _autoEvent: 1,
      })
      .sort({ startAt: 1, updatedAt: -1 })
      .skip(skip)
      .limit(safePageSize)
      .lean<IEventoDoc[]>(),
    Model.countDocuments(filter),
  ]);

  // join owner
  const ownerIds = Array.from(
    new Set(
      docsOut
        .map((m: any) => (m.owner ? String(m.owner) : null))
        .filter(Boolean),
    ),
  ) as string[];

  let ownerMap = new Map<string, { name: string; email: string }>();
  if (ownerIds.length) {
    const owners = await UserModel.find(
      { _id: { $in: ownerIds.map((x) => new mongoose.Types.ObjectId(x)) } },
      { name: 1, email: 1 },
    ).lean();
    ownerMap = new Map(
      owners.map((u: any) => [
        String(u._id),
        { name: u.name || u.email || "(utente)", email: u.email || "" },
      ]),
    );
  }

  const items: EventoPreview[] = docsOut.map((m: any) => {
    const data = m.data || {};

    const joinVals = (keys: string[]) =>
      keys
        .map((k) => data?.[k] ?? "")
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(String);

    const displayName =
      joinVals(def.preview.title).join(" ") || "(senza titolo)";
    const subtitle = joinVals(def.preview.subtitle).join(" · ") || null;

    const ownerIdStr = m.owner ? String(m.owner) : null;
    const ownerInfo = ownerIdStr ? ownerMap.get(ownerIdStr) : undefined;

    return {
      id: String(m._id),
      displayName,
      subtitle,
      timeKind: m.timeKind,
      startAt: m.startAt ? new Date(m.startAt).toISOString() : null,
      endAt: m.endAt ? new Date(m.endAt).toISOString() : null,
      updatedAt: new Date(m.updatedAt).toISOString(),
      visibilityRole: m.visibilityRole || null,
      ownerId: ownerIdStr,
      ownerName: ownerInfo?.name || null,
    };
  });

  return { items, total };
}

/* ----------------------------------- CREATE --------------------------------- */

export async function createEvento(params: {
  type: string;
  userId: string;
  data: Record<string, any>;
  timeKind: TimeKind;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: boolean;
  recurrence?:
    | {
    rrule?: string | null;
    until?: string | null;
    count?: number | null;
    masterId?: string | null;
  }
    | null;
  gruppo?:
    | {
    gruppoType: string;
    gruppoId: string;
  }
    | null;
  partecipanti?: EventoPartecipanteView[];
  visibilityRole?: string | null;
  _autoEvent?: string | null;
}): Promise<{ id: string }> {
  const {
    type,
    userId,
    data,
    timeKind,
    startAt,
    endAt,
    allDay,
    recurrence,
    gruppo,
    partecipanti,
    visibilityRole,
    _autoEvent,
  } = params;

  await connectToDatabase();
  const Model = getEventoModel(type);

  const owner = new mongoose.Types.ObjectId(userId);

  const doc: Partial<IEventoDoc> = {
    data,
    timeKind,
    startAt: startAt ? new Date(startAt) : null,
    endAt: endAt ? new Date(endAt) : null,
    allDay: !!allDay,
    recurrence: recurrence
      ? {
        rrule: recurrence.rrule ?? null,
        until: recurrence.until ? new Date(recurrence.until) : null,
        count: typeof recurrence.count === "number" ? recurrence.count : null,
        masterId: recurrence.masterId
          ? new mongoose.Types.ObjectId(recurrence.masterId)
          : null,
      }
      : null,
    gruppo: gruppo
      ? {
        gruppoType: gruppo.gruppoType,
        gruppoId: new mongoose.Types.ObjectId(gruppo.gruppoId),
      }
      : null,
    partecipanti: (partecipanti ?? []).map((p) => ({
      anagraficaType: p.anagraficaType,
      anagraficaId: new mongoose.Types.ObjectId(p.anagraficaId),
      role: p.role ?? null,
      status: p.status ?? null,
      quantity: typeof p.quantity === "number" ? p.quantity : null,
      note: p.note ?? null,
    })),
    visibilityRole: visibilityRole ?? null,
    owner,
    createdBy: owner,
    updatedBy: owner,
    _autoEvent: _autoEvent ?? null,
  };

  const created = await Model.create(doc);
  return { id: String(created._id) };
}

/* ------------------------------- GET BY ID (FULL) --------------------------- */

export async function getEventoById(params: {
  type: string;
  id: string;
}): Promise<EventoFull | null> {
  const { type, id } = params;

  await connectToDatabase();
  const Model = getEventoModel(type);

  const raw = await Model.findById(id).lean<IEventoDoc | null>();
  if (!raw) return null;

  // join documents per attachments
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

  const recurrence: EventoRecurrenceView | null = raw.recurrence
    ? {
      rrule: raw.recurrence.rrule ?? null,
      until: raw.recurrence.until
        ? new Date(raw.recurrence.until).toISOString()
        : null,
      count: typeof raw.recurrence.count === "number" ? raw.recurrence.count : null,
      masterId: raw.recurrence.masterId ? String(raw.recurrence.masterId) : null,
    }
    : null;

  const gruppo: EventoGruppoView | null = raw.gruppo
    ? {
      gruppoType: raw.gruppo.gruppoType,
      gruppoId: String(raw.gruppo.gruppoId),
    }
    : null;

  const partecipanti: EventoPartecipanteView[] = (raw.partecipanti ?? []).map(
    (p: any) => ({
      anagraficaType: p.anagraficaType,
      anagraficaId: String(p.anagraficaId),
      role: p.role ?? null,
      status: p.status ?? null,
      quantity: typeof p.quantity === "number" ? p.quantity : null,
      note: p.note ?? null,
    }),
  );

  return {
    id: String(raw._id),
    data: raw.data || {},
    timeKind: raw.timeKind,
    startAt: raw.startAt ? new Date(raw.startAt).toISOString() : null,
    endAt: raw.endAt ? new Date(raw.endAt).toISOString() : null,
    allDay: !!raw.allDay,
    recurrence,
    gruppo,
    partecipanti,
    visibilityRole: raw.visibilityRole ?? null,
    attachments,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : undefined,
    _autoEvent: raw._autoEvent ?? null,
  };
}

/* ----------------------------------- UPDATE --------------------------------- */

export async function updateEvento(params: {
  type: string;
  id: string;
  updatedById: string;
  data?: Record<string, any>;
  timeKind?: TimeKind;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: boolean;
  recurrence?:
    | {
    rrule?: string | null;
    until?: string | null;
    count?: number | null;
    masterId?: string | null;
  }
    | null;
  gruppo?:
    | {
    gruppoType: string;
    gruppoId: string;
  }
    | null;
  partecipanti?: EventoPartecipanteView[];
  visibilityRole?: string | null;
}): Promise<EventoFull | null> {
  const {
    type,
    id,
    updatedById,
    data,
    timeKind,
    startAt,
    endAt,
    allDay,
    recurrence,
    gruppo,
    partecipanti,
    visibilityRole,
  } = params;

  await connectToDatabase();
  const Model = getEventoModel(type);

  const update: any = {
    updatedBy: new mongoose.Types.ObjectId(updatedById),
  };

  if (data && typeof data === "object") update.data = data;
  if (typeof timeKind !== "undefined") update.timeKind = timeKind;
  if (typeof allDay !== "undefined") update.allDay = !!allDay;

  if (typeof startAt !== "undefined") update.startAt = startAt ? new Date(startAt) : null;
  if (typeof endAt !== "undefined") update.endAt = endAt ? new Date(endAt) : null;

  if (typeof recurrence !== "undefined") {
    update.recurrence = recurrence
      ? {
        rrule: recurrence.rrule ?? null,
        until: recurrence.until ? new Date(recurrence.until) : null,
        count: typeof recurrence.count === "number" ? recurrence.count : null,
        masterId: recurrence.masterId
          ? new mongoose.Types.ObjectId(recurrence.masterId)
          : null,
      }
      : null;
  }

  if (typeof gruppo !== "undefined") {
    update.gruppo = gruppo
      ? {
        gruppoType: gruppo.gruppoType,
        gruppoId: new mongoose.Types.ObjectId(gruppo.gruppoId),
      }
      : null;
  }

  if (typeof partecipanti !== "undefined") {
    update.partecipanti = (partecipanti ?? []).map((p) => ({
      anagraficaType: p.anagraficaType,
      anagraficaId: new mongoose.Types.ObjectId(p.anagraficaId),
      role: p.role ?? null,
      status: p.status ?? null,
      quantity: typeof p.quantity === "number" ? p.quantity : null,
      note: p.note ?? null,
    }));
  }

  if (typeof visibilityRole !== "undefined") {
    update.visibilityRole = visibilityRole;
  }

  const updated = await Model.findByIdAndUpdate(id, update, {
    new: true,
  }).lean<IEventoDoc | null>();

  if (!updated) return null;

  return getEventoById({ type, id });
}

/* ----------------------------------- DELETE --------------------------------- */

export async function deleteEvento(params: {
  type: string;
  id: string;
}): Promise<{ ok: boolean; id?: string }> {
  const { type, id } = params;

  if (!mongoose.isValidObjectId(id)) {
    throw new Error("INVALID_ID");
  }

  await connectToDatabase();
  const Model = getEventoModel(type);

  const deleted = await Model.findByIdAndDelete(id).lean();
  if (!deleted) {
    return { ok: false };
  }

  return { ok: true, id: String(deleted._id) };
}

/* -------------------------- ATTACHMENT: ADD / REMOVE ------------------------ */

export async function addAttachmentToEvento(params: {
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
  const Model = getEventoModel(type);

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

export async function removeAttachmentFromEvento(params: {
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
  const Model = getEventoModel(type);

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
