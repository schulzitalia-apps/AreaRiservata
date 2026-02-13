import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserResourceKeyModel from "@/server-utils/models/userResourceKey";
import type { KeyScopes } from "@/server-utils/lib/auth-context";

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

  return scopes;
}
