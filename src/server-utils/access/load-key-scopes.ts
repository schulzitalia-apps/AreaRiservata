import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserResourceKeyModel from "@/server-utils/models/userResourceKey";
import type { KeyScopes } from "@/server-utils/lib/auth-context";
import { getAulaDef } from "@/config/aule.registry";
import { getAulaModel } from "@/server-utils/models/aule.factory";

/**
 * Carica tutte le KEY dell'utente e le raggruppa per:
 *  - scopeKind ("anagrafica", "aula", "evento", ...)
 *  - scopeSlug (es: "clienti", "cantieri", "avvisi", ...)
 *
 * Ritorna qualcosa tipo:
 *  {
 *    anagrafica: {
 *      clienti: ["64f...", "650..."],
 *      "conferme-ordine": ["651..."]
 *    },
 *    aula: {
 *      cantieri: ["700..."]
 *    }
 *  }
 */
export async function loadUserKeyScopes(userId: string): Promise<KeyScopes> {
  await connectToDatabase();

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const links = await UserResourceKeyModel.find({
    userId: userObjectId,
  })
    .select({ scopeKind: 1, scopeSlug: 1, resourceId: 1 })
    .lean();

  const scopes: KeyScopes = {};

  for (const link of links as any[]) {
    const kind = link.scopeKind || "anagrafica"; // fallback di sicurezza
    const slug = String(link.scopeSlug);
    const idStr = String(link.resourceId);

    if (!scopes[kind]) {
      scopes[kind] = {};
    }
    if (!scopes[kind]![slug]) {
      scopes[kind]![slug] = [];
    }
    scopes[kind]![slug]!.push(idStr);
  }

  const aulaScopes = scopes["aula"];
  if (!aulaScopes) {
    return scopes;
  }

  const derivedAnagraficaScopes = scopes["anagrafica"] ?? {};

  for (const [aulaSlug, aulaIds] of Object.entries(aulaScopes)) {
    if (!Array.isArray(aulaIds) || !aulaIds.length) continue;

    let aulaDef;
    try {
      aulaDef = getAulaDef(aulaSlug);
    } catch {
      continue;
    }

    const objectIds = aulaIds
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (!objectIds.length) continue;

    const AulaModel = getAulaModel(aulaSlug);
    const aulaDocs = await AulaModel.find({
      _id: { $in: objectIds },
    })
      .select({ partecipanti: 1 })
      .lean();

    const participantIds = new Set<string>();
    for (const doc of aulaDocs as any[]) {
      const partecipanti = Array.isArray(doc?.partecipanti) ? doc.partecipanti : [];
      for (const partecipante of partecipanti) {
        const anagraficaId = partecipante?.anagraficaId;
        if (anagraficaId) {
          participantIds.add(String(anagraficaId));
        }
      }
    }

    if (!participantIds.size) continue;

    const targetSlug = String(aulaDef.anagraficaSlug);
    const merged = new Set<string>(derivedAnagraficaScopes[targetSlug] ?? []);
    for (const participantId of participantIds) {
      merged.add(participantId);
    }
    derivedAnagraficaScopes[targetSlug] = Array.from(merged);
  }

  if (Object.keys(derivedAnagraficaScopes).length) {
    scopes["anagrafica"] = derivedAnagraficaScopes;
  }

  return scopes;
}
