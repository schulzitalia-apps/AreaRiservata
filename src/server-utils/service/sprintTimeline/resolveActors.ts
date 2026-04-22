import mongoose from "mongoose";
import UserModel from "@/server-utils/models/User";
import UserResourceKeyModel from "@/server-utils/models/userResourceKey";

export type ResolvedActor = {
  name: string;
  userId?: string;
  anagraficaId?: string;
};

/**
 * Risolve un nome o email in userId ed eventualmente l'id anagrafica (evolver) collegato.
 */
export async function resolveActorByName(name: string): Promise<ResolvedActor> {
  const normalized = name.trim();
  if (!normalized) return { name };

  const user = await UserModel.findOne(
    {
      $or: [{ name: normalized }, { email: normalized }],
    },
    { _id: 1 },
  ).lean();

  if (!user) return { name: normalized };

  const userId = String(user._id);

  // Cerca il link anagrafica 'evolver' per questo utente
  const link = await UserResourceKeyModel.findOne({
    userId: user._id,
    scopeKind: "anagrafica",
    scopeSlug: "evolver",
  })
    .select({ resourceId: 1 })
    .lean();

  return {
    name: normalized,
    userId,
    anagraficaId: link ? String(link.resourceId) : undefined,
  };
}

/**
 * Risolve un set di nomi in attori strutturati in batch.
 */
export async function resolveActorsByNames(names: string[]): Promise<ResolvedActor[]> {
  const uniqueNames = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (!uniqueNames.length) return [];

  const users = await UserModel.find(
    {
      $or: [{ name: { $in: uniqueNames } }, { email: { $in: uniqueNames } }],
    },
    { _id: 1, name: 1, email: 1 },
  ).lean();

  if (!users.length) {
    return uniqueNames.map((name) => ({ name }));
  }

  const userIds = users.map((u) => u._id);
  const links = await UserResourceKeyModel.find({
    userId: { $in: userIds },
    scopeKind: "anagrafica",
    scopeSlug: "evolver",
  })
    .select({ userId: 1, resourceId: 1 })
    .lean();

  const linkMap = new Map<string, string>();
  for (const link of links) {
    linkMap.set(String(link.userId), String(link.resourceId));
  }

  const results: ResolvedActor[] = [];

  // Mappa i nomi originali ai risultati risolti
  for (const originalName of uniqueNames) {
    const normalized = originalName.toLowerCase();
    const user = users.find(
      (u) =>
        u.name?.trim().toLowerCase() === normalized ||
        u.email?.trim().toLowerCase() === normalized,
    );

    if (user) {
      const userId = String(user._id);
      results.push({
        name: originalName,
        userId,
        anagraficaId: linkMap.get(userId),
      });
    } else {
      results.push({ name: originalName });
    }
  }

  return results;
}

/**
 * Risolve un userId nella sua reference anagrafica (evolver) corrispondente.
 */
export async function resolveEvolverAnagraficaByUserId(
  userId: string,
): Promise<string | undefined> {
  if (!mongoose.isValidObjectId(userId)) return undefined;

  const link = await UserResourceKeyModel.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    scopeKind: "anagrafica",
    scopeSlug: "evolver",
  })
    .select({ resourceId: 1 })
    .lean();

  return link ? String(link.resourceId) : undefined;
}
