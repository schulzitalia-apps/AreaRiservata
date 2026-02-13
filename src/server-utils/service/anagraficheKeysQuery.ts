// src/server-utils/service/anagraficheKeysQuery.ts
import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";

import UserResourceKeyModel from "@/server-utils/models/userResourceKey";

import { getAnagraficaModel } from "@/server-utils/models/Anagrafiche/anagrafiche.factory";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

export type UserAnagraficaKeyPreview = {
  type: string; // slug anagrafica: "clienti", "conferme-ordine", ...
  anagraficaId: string;
  displayName: string;
  subtitle: string | null;
  updatedAt: string | null;
};

/**
 * Restituisce tutte le anagrafiche collegate a un utente (KEY di tipo "anagrafica"),
 * con preview (title/subtitle) pronta per la UI.
 */
export async function listUserAnagraficaKeysPreview(
  userId: string,
): Promise<UserAnagraficaKeyPreview[]> {
  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const links = await UserResourceKeyModel.find({
    userId: userObjectId,
    scopeKind: "anagrafica",
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

  const items: UserAnagraficaKeyPreview[] = [];

  for (const [slug, ids] of byType.entries()) {
    const anagraficaSlug = slug as AnagraficaTypeSlug;
    const Model = getAnagraficaModel(anagraficaSlug);
    const def = getAnagraficaDef(anagraficaSlug);

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
          .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
          .map(String);

      const displayName = joinVals(def.preview.title).join(" ");
      const subtitle = joinVals(def.preview.subtitle).join(" · ") || null;

      items.push({
        type: slug,
        anagraficaId: String(doc._id),
        displayName: displayName || "(senza titolo)",
        subtitle,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
      });
    }
  }

  return items;
}

/**
 * Crea un collegamento (KEY) utente ↔ anagrafica usando il modello generico.
 */
export async function createUserAnagraficaKey(params: {
  userId: string;
  anagraficaType: AnagraficaTypeSlug;
  anagraficaId: string;
}): Promise<{
  id: string;
  userId: string;
  anagraficaType: string;
  anagraficaId: string;
}> {
  const { userId, anagraficaType, anagraficaId } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const anagraficaObjectId = new mongoose.Types.ObjectId(anagraficaId);

  const Model = getAnagraficaModel(anagraficaType);
  const exists = await Model.exists({ _id: anagraficaObjectId });
  if (!exists) {
    const err: any = new Error("Anagrafiche non trovata");
    err.code = "ANAGRAFICA_NOT_FOUND";
    throw err;
  }

  const created = await UserResourceKeyModel.create({
    userId: userObjectId,
    scopeKind: "anagrafica",
    scopeSlug: anagraficaType,
    resourceId: anagraficaObjectId,
  });

  return {
    id: String(created._id),
    userId: String(userObjectId),
    anagraficaType,
    anagraficaId,
  };
}

/**
 * Cancella un collegamento utente ↔ anagrafica.
 */
export async function deleteUserAnagraficaKey(params: {
  userId: string;
  anagraficaType: AnagraficaTypeSlug;
  anagraficaId: string;
}): Promise<number> {
  const { userId, anagraficaType, anagraficaId } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const anagraficaObjectId = new mongoose.Types.ObjectId(anagraficaId);

  const res = await UserResourceKeyModel.deleteOne({
    userId: userObjectId,
    scopeKind: "anagrafica",
    scopeSlug: anagraficaType,
    resourceId: anagraficaObjectId,
  });

  return res.deletedCount ?? 0;
}
