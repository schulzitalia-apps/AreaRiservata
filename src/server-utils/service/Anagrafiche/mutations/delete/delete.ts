// src/server-utils/service/Anagrafiche/mutations/delete/delete.ts

import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getAnagraficaModel } from "@/server-utils/models/Anagrafiche/anagrafiche.factory";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";

import type { DeleteAnagraficaParams } from "../../types";
import { normalizeDeleteInput } from "../builders/input";
import { writeDeleteAnagrafica } from "../writers/delete";

/**
 * 💡 Mutation: deleteAnagrafica
 * ----------------------------
 * Cancella una anagrafica per id.
 *
 * Pipeline:
 * 1) normalize input (cheap validation)
 * 2) connect DB
 * 3) resolve model dinamico (slug => collection)
 * 4) execute delete (writer)
 *
 * Output:
 * - { ok:false } se non trovato
 * - { ok:true, id } se cancellato
 *
 * Nota:
 * - qui NON applichiamo ACL: se vuoi enforcement ACL lato server,
 *   la versione "seria" è un delete by filter (findOneAndDelete con accessFilter).
 */
export async function deleteAnagrafica(
  params: DeleteAnagraficaParams,
): Promise<{ ok: boolean; id?: string }> {
  // 1) normalize input
  const { type, id } = normalizeDeleteInput(params);

  // 2) connect DB
  await connectToDatabase();

  // 3) model dinamico
  const slug = type as AnagraficaTypeSlug;
  const Model = getAnagraficaModel(slug);

  // 4) delete (writer usa payload, come writeCreateAnagrafica)
  const deleted = await writeDeleteAnagrafica(Model, { id });

  if (!deleted) return { ok: false };

  return { ok: true, id: String(deleted._id) };
}
