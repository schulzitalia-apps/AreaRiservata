// src/server-utils/service/Anagrafiche/list/joins/owners.ts
import mongoose from "mongoose";
import UserModel from "@/server-utils/models/User";

/**
 * EVOLVE ATLAS — Join Owners
 * -------------------------
 * Join “manuale” per arricchire la preview con ownerName.
 *
 * Obiettivo:
 * - estrarre gli ownerId dai docs
 * - fetchare gli utenti in batch (una query)
 * - restituire una Map per lookup O(1) durante il mapping
 *
 * Nota:
 * - è un join applicativo perché i documenti anagrafica vivono in collection dinamiche
 * - evitiamo populate per avere più controllo e meno overhead
 */

export type OwnerInfo = { name: string; email: string };

export async function buildOwnerMap(docs: any[]): Promise<Map<string, OwnerInfo>> {
  const ownerIds = Array.from(
    new Set(
      (docs || [])
        .map((m: any) => (m?.owner ? String(m.owner) : null))
        .filter(Boolean),
    ),
  ) as string[];

  if (!ownerIds.length) return new Map();

  const owners = await UserModel.find(
    { _id: { $in: ownerIds.map((x) => new mongoose.Types.ObjectId(x)) } },
    { name: 1, email: 1 },
  ).lean();

  return new Map(
    owners.map((u: any) => [
      String(u._id),
      {
        name: u.name || u.email || "(utente)",
        email: u.email || "",
      },
    ]),
  );
}
