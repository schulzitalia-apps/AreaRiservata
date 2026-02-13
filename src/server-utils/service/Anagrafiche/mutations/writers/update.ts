import type { Model } from "mongoose";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/**
 * Writer: update su DB
 * --------------------
 * Esegue fisicamente l'update su Mongo.
 *
 * Perché separato:
 * - i writer contengono side-effect (query DB)
 * - i builder restano funzioni pure e testabili
 */
type MongoUpdateOps = {
  $set?: Record<string, any>;
  $unset?: Record<string, any>;
};

export async function writeUpdateAnagrafica(
  Model: Model<IAnagraficaDoc>,
  id: string,
  updateOps: MongoUpdateOps,
): Promise<any | null> {
  const hasSet = !!updateOps?.$set && Object.keys(updateOps.$set!).length > 0;
  const hasUnset = !!updateOps?.$unset && Object.keys(updateOps.$unset!).length > 0;

  /**
   * Caso raro: nessuna modifica effettiva.
   * - Può succedere se input.data era vuoto o tutte chiavi non modificabili.
   * - In quel caso restituiamo il doc corrente (read-only).
   *
   * Nota: qui fai 1 query di read; alternativa: return null e gestisci a monte.
   */
  if (!hasSet && !hasUnset) {
    const current = await Model.findById(id).lean();
    return current ?? null;
  }

  /**
   * findByIdAndUpdate atomico
   * - applichiamo $set/$unset in un'unica operazione
   * - {new:true} => ritorna il documento aggiornato
   */
  const updated = await Model.findByIdAndUpdate(id, updateOps as any, {
    new: true,
  }).lean();

  return updated ?? null;
}
