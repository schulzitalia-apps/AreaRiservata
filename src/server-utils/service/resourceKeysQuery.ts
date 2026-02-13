// src/server-utils/service/resourceKeysQuery.ts
import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserResourceKeyModel from "@/server-utils/models/userResourceKey";

export type UserResourceKeyItem = {
  id: string;
  userId: string;
  scopeKind: string;
  scopeSlug: string;
  resourceId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Lista grezza di tutte le KEY di un utente, con filtri opzionali per
 * scopeKind e scopeSlug.
 *
 * NON fa join con le anagrafiche/aule/eventi, è solo uno strato generico.
 */
export async function listUserResourceKeys(params: {
  userId: string;
  scopeKind?: string;
  scopeSlug?: string;
}): Promise<UserResourceKeyItem[]> {
  const { userId, scopeKind, scopeSlug } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const filter: any = { userId: userObjectId };
  if (scopeKind) filter.scopeKind = scopeKind;
  if (scopeSlug) filter.scopeSlug = scopeSlug;

  const links = await UserResourceKeyModel.find(filter)
    .select({
      scopeKind: 1,
      scopeSlug: 1,
      resourceId: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean();

  return (links as any[]).map((link) => ({
    id: String(link._id),
    userId: String(userObjectId),
    scopeKind: String(link.scopeKind),
    scopeSlug: String(link.scopeSlug),
    resourceId: String(link.resourceId),
    createdAt: link.createdAt
      ? new Date(link.createdAt).toISOString()
      : null,
    updatedAt: link.updatedAt
      ? new Date(link.updatedAt).toISOString()
      : null,
  }));
}

/**
 * Crea un collegamento (KEY) utente ↔ risorsa generica.
 *
 * NON verifica che la risorsa esista: questa logica va gestita
 * a livello di dominio (anagrafiche / aule / eventi).
 *
 * Può lanciare:
 *  - errore Mongo code === 11000 se il link esiste già (unique index)
 */
export async function createUserResourceKey(params: {
  userId: string;
  scopeKind: string;
  scopeSlug: string;
  resourceId: string;
}): Promise<UserResourceKeyItem> {
  const { userId, scopeKind, scopeSlug, resourceId } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const resourceObjectId = new mongoose.Types.ObjectId(resourceId);

  const created = await UserResourceKeyModel.create({
    userId: userObjectId,
    scopeKind,
    scopeSlug,
    resourceId: resourceObjectId,
  });

  return {
    id: String(created._id),
    userId: String(userObjectId),
    scopeKind,
    scopeSlug,
    resourceId,
    createdAt: created.createdAt
      ? new Date(created.createdAt).toISOString()
      : null,
    updatedAt: created.updatedAt
      ? new Date(created.updatedAt).toISOString()
      : null,
  };
}

/**
 * Cancella un collegamento utente ↔ risorsa generica.
 * Ritorna deletedCount (0 oppure 1).
 */
export async function deleteUserResourceKey(params: {
  userId: string;
  scopeKind: string;
  scopeSlug: string;
  resourceId: string;
}): Promise<number> {
  const { userId, scopeKind, scopeSlug, resourceId } = params;

  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const resourceObjectId = new mongoose.Types.ObjectId(resourceId);

  const res = await UserResourceKeyModel.deleteOne({
    userId: userObjectId,
    scopeKind,
    scopeSlug,
    resourceId: resourceObjectId,
  });

  return res.deletedCount ?? 0;
}
