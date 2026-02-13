// src/server-utils/service/auleKeysQuery.ts
import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";

import UserResourceKeyModel from "@/server-utils/models/userResourceKey";

import { getAulaModel } from "@/server-utils/models/aule.factory";
import { getAulaDef } from "@/config/aule.registry";
import type { AulaTypeSlug } from "@/config/aule.types.public";

export type UserAulaKeyPreview = {
  type: string;        // slug aula: "cantieri", "agenti", ...
  aulaId: string;
  displayName: string;
  subtitle: string | null;
  updatedAt: string | null;
};

/**
 * Restituisce tutte le AULE collegate a un utente (KEY di tipo "aula"),
 * con preview (title/subtitle) pronta per la UI admin.
 */
export async function listUserAulaKeysPreview(
  userId: string
): Promise<UserAulaKeyPreview[]> {
  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const links = await UserResourceKeyModel.find({
    userId: userObjectId,
    scopeKind: "aula",
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

  const items: UserAulaKeyPreview[] = [];

  for (const [slug, ids] of byType.entries()) {
    const aulaSlug = slug as AulaTypeSlug;
    const Model = getAulaModel(aulaSlug);
    const def = getAulaDef(aulaSlug);

    const previewKeys = new Set<string>([
      ...def.preview.title,
      ...def.preview.subtitle,
    ]);

    const datiProjection: Record<string, 1> = {};
    previewKeys.forEach((k) => {
      datiProjection[`dati.${k}`] = 1;
    });

    const docs = await Model.find({
      _id: { $in: ids.map((x) => new mongoose.Types.ObjectId(x)) },
    })
      .select({
        ...datiProjection,
        updatedAt: 1,
      })
      .lean();

    for (const doc of docs as any[]) {
      const dati = doc.dati || {};

      const joinVals = (keys: string[]) =>
        keys
          .map((k) => dati?.[k] ?? "")
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
        aulaId: String(doc._id),
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
 * Crea un collegamento (KEY) utente ↔ aula.
 */
export async function createUserAulaKey(params: {
  userId: string;
  aulaType: AulaTypeSlug;
  aulaId: string;
}): Promise<{
  id: string;
  userId: string;
  aulaType: string;
  aulaId: string;
}> {
  const { userId, aulaType, aulaId } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const aulaObjectId = new mongoose.Types.ObjectId(aulaId);

  const Model = getAulaModel(aulaType);
  const exists = await Model.exists({ _id: aulaObjectId });
  if (!exists) {
    const err: any = new Error("Aula non trovata");
    err.code = "AULA_NOT_FOUND";
    throw err;
  }

  const created = await UserResourceKeyModel.create({
    userId: userObjectId,
    scopeKind: "aula",
    scopeSlug: aulaType,
    resourceId: aulaObjectId,
  });

  return {
    id: String(created._id),
    userId: String(userObjectId),
    aulaType,
    aulaId,
  };
}

/**
 * Cancella un collegamento utente ↔ aula.
 */
export async function deleteUserAulaKey(params: {
  userId: string;
  aulaType: AulaTypeSlug;
  aulaId: string;
}): Promise<number> {
  const { userId, aulaType, aulaId } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const aulaObjectId = new mongoose.Types.ObjectId(aulaId);

  const res = await UserResourceKeyModel.deleteOne({
    userId: userObjectId,
    scopeKind: "aula",
    scopeSlug: aulaType,
    resourceId: aulaObjectId,
  });

  return res.deletedCount ?? 0;
}
