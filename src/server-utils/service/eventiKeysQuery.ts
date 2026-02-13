// src/server-utils/service/eventiKeysQuery.ts
import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";

import UserResourceKeyModel from "@/server-utils/models/userResourceKey";

import { getEventoModel } from "@/server-utils/models/eventi.factory";
import { getEventoDef } from "@/config/eventi.registry";
import type { EventoTypeSlug } from "@/config/eventi.types.public";

export type UserEventoKeyPreview = {
  type: string;        // slug evento: "avvisi", ...
  eventoId: string;
  displayName: string;
  subtitle: string | null;
  updatedAt: string | null;
};

/**
 * Restituisce tutti gli EVENTI collegati a un utente (KEY di tipo "evento"),
 * con preview (title/subtitle) pronta per la UI.
 */
export async function listUserEventoKeysPreview(
  userId: string
): Promise<UserEventoKeyPreview[]> {
  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const links = await UserResourceKeyModel.find({
    userId: userObjectId,
    scopeKind: "evento",
  })
    .select({ scopeSlug: 1, resourceId: 1 })
    .lean();

  if (!links.length) return [];

  const byType = new Map<string, string[]>();
  for (const link of links as any[]) {
    const slug = String(link.scopeSlug);
    const idStr = String(link.resourceId);
    if (!byType.has(slug)) byType.set(slug, []);
    byType.get(slug)!.push(idStr);
  }

  const items: UserEventoKeyPreview[] = [];

  for (const [slug, ids] of byType.entries()) {
    const eventoSlug = slug as EventoTypeSlug;
    const Model = getEventoModel(eventoSlug);
    const def = getEventoDef(eventoSlug);

    const previewKeys = new Set<string>([
      ...def.preview.title,
      ...def.preview.subtitle,
    ]);

    const dataProjection: Record<string, 1> = {};
    previewKeys.forEach((k) => {
      dataProjection[`data.${k}`] = 1;
    });

    const docs = await Model.find({
      _id: { $in: ids.map((x) => new mongoose.Types.ObjectId(x)) },
    })
      .select({
        ...dataProjection,
        updatedAt: 1,
      })
      .lean();

    for (const doc of docs as any[]) {
      const data = doc.data || {};

      const joinVals = (keys: string[]) =>
        keys
          .map((k) => data?.[k] ?? "")
          .filter(
            (v) =>
              v !== null &&
              v !== undefined &&
              String(v).trim() !== "",
          )
          .map(String);

      const displayName =
        joinVals(def.preview.title).join(" ") || "(senza titolo)";
      const subtitle =
        joinVals(def.preview.subtitle).join(" · ") || null;

      items.push({
        type: slug,
        eventoId: String(doc._id),
        displayName,
        subtitle,
        updatedAt: doc.updatedAt
          ? new Date(doc.updatedAt).toISOString()
          : null,
      });
    }
  }

  return items;
}

/**
 * Crea un collegamento (KEY) utente ↔ evento.
 */
export async function createUserEventoKey(params: {
  userId: string;
  eventoType: EventoTypeSlug;
  eventoId: string;
}): Promise<{
  id: string;
  userId: string;
  eventoType: string;
  eventoId: string;
}> {
  const { userId, eventoType, eventoId } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const eventoObjectId = new mongoose.Types.ObjectId(eventoId);

  const Model = getEventoModel(eventoType);
  const exists = await Model.exists({ _id: eventoObjectId });
  if (!exists) {
    const err: any = new Error("Evento non trovato");
    err.code = "EVENTO_NOT_FOUND";
    throw err;
  }

  const created = await UserResourceKeyModel.create({
    userId: userObjectId,
    scopeKind: "evento",
    scopeSlug: eventoType,
    resourceId: eventoObjectId,
  });

  return {
    id: String(created._id),
    userId: String(userObjectId),
    eventoType,
    eventoId,
  };
}

/**
 * Cancella un collegamento utente ↔ evento.
 */
export async function deleteUserEventoKey(params: {
  userId: string;
  eventoType: EventoTypeSlug;
  eventoId: string;
}): Promise<number> {
  const { userId, eventoType, eventoId } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const eventoObjectId = new mongoose.Types.ObjectId(eventoId);

  const res = await UserResourceKeyModel.deleteOne({
    userId: userObjectId,
    scopeKind: "evento",
    scopeSlug: eventoType,
    resourceId: eventoObjectId,
  });

  return res.deletedCount ?? 0;
}
