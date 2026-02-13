import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getAnagraficaModel } from "@/server-utils/models/Anagrafiche/anagrafiche.factory";

import type { UpdateAnagraficaParams, AnagraficaFull } from "../../types";

import { normalizeUpdateInput } from "../builders/input";
import { buildDataPatchOps } from "../builders/data";
import { buildAuditPatchOps } from "../builders/audit";
import { buildMongoUpdateOps } from "../builders/ops";

import { writeUpdateAnagrafica } from "../writers/update";
import { mapToAnagraficaFull } from "../mappers/full";

/**
 * EVOLVE ATLAS — Update Anagrafica (orchestratore)
 * -----------------------------------------------
 * Questa è la mutation “singola” che sostituisce la distinzione PUT/PATCH:
 *
 * Semantica:
 * - params.data è un delta: contiene SOLO i campi che l'utente ha toccato.
 * - per ciascun campo in data:
 *   - se valore è vuoto (""/null/undefined/[]/whitespace) => $unset data.<key>
 *   - altrimenti => cast by config => $set data.<key> = valore
 * - params.visibilityRoles:
 *   - se presente => $set visibilityRoles
 *   - se assente => non tocchiamo visibilityRoles
 *
 * Perché così:
 * - Mixed non casta (Mongoose) => casting server-side necessario
 * - “sparse fields” (variant) => non salvare chiavi vuote riduce size e indexSize
 * - update atomico => 1 sola query Mongo (no read+merge)
 *
 * Sequenza logica:
 * 1) validate input (id/type/updatedBy)
 * 2) connect DB + get model dinamico
 * 3) build ops: data.* ($set/$unset)
 * 4) build ops: audit (updatedBy)
 * 5) opzionale: ops su core (visibilityRoles)
 * 6) merge ops
 * 7) write (findByIdAndUpdate)
 * 8) map output DTO
 */
export async function updateAnagrafica(
  params: UpdateAnagraficaParams,
): Promise<AnagraficaFull | null> {
  // 1) Validazione minima input (no side-effect)
  const { type, id, updatedById } = normalizeUpdateInput(params);

  // 2) DB + model dinamico (uno per collection/slug)
  await connectToDatabase();
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  // 3) Delta ops su data.* (config-driven casting + unset vuoti)
  const dataOps = buildDataPatchOps(slug, params.data);

  // 4) Audit ops (updatedBy sempre aggiornato quando scriviamo)
  const auditOps = buildAuditPatchOps(updatedById);

  // 5) Core ops opzionali (solo se campo presente nel payload)
  const visibilityOps =
    typeof params.visibilityRoles !== "undefined"
      ? { $set: { visibilityRoles: params.visibilityRoles ?? [] } }
      : null;

  // 6) Merge finale: un unico oggetto di update Mongo {$set,$unset}
  const updateOps = buildMongoUpdateOps([dataOps, auditOps, visibilityOps]);

  // 7) Write (atomico)
  const updated = await writeUpdateAnagrafica(Model, id, updateOps);
  if (!updated) return null;

  // 8) Map output (DTO)
  return mapToAnagraficaFull(updated);
}
