/**
 * Builder: merge ops Mongo ($set/$unset)
 * -------------------------------------
 * Scopo:
 * - unire più "pezzi" di update ops (dataOps, auditOps, visibilityOps, ...)
 * - produrre un singolo oggetto compatibile con findByIdAndUpdate
 *
 * Perché esiste:
 * - teniamo i builder piccoli e testabili
 * - l’orchestratore (update.ts) resta leggibile
 *
 * Regole:
 * - accetta pezzi null/undefined (li ignora)
 * - mergea $set e $unset in modo additivo
 * - se una chiave è sia in $set che in $unset:
 *   - vince $unset (per evitare di "settare e rimuovere" la stessa chiave)
 */

export type MongoUpdateOps = {
  $set?: Record<string, any>;
  $unset?: Record<string, any>;
};

export function buildMongoUpdateOps(
  parts: Array<MongoUpdateOps | null | undefined>,
): MongoUpdateOps {
  const set: Record<string, any> = {};
  const unset: Record<string, any> = {};

  for (const p of parts) {
    if (!p) continue;

    if (p.$set) {
      for (const [k, v] of Object.entries(p.$set)) {
        set[k] = v;
      }
    }

    if (p.$unset) {
      for (const [k, v] of Object.entries(p.$unset)) {
        unset[k] = v;
      }
    }
  }

  // Se la stessa chiave sta in $unset, non deve stare anche in $set
  for (const k of Object.keys(unset)) {
    if (k in set) delete set[k];
  }

  const out: MongoUpdateOps = {};
  if (Object.keys(set).length) out.$set = set;
  if (Object.keys(unset).length) out.$unset = unset;

  return out;
}
