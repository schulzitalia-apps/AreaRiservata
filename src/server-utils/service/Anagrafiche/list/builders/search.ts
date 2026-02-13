// src/server-utils/service/Anagrafiche/list/builders/search.ts
import mongoose from "mongoose";
import type { FilterQuery } from "mongoose";

import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import { isReferenceField } from "@/config/anagrafiche.fields.catalog";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/**
 * EVOLVE ATLAS — Builder Search (opzionale)
 * ----------------------------------------
 * Questo builder costruisce la porzione di filtro relativa alla searchbar.
 *
 * Obiettivo:
 * - costruire una condizione `$or` sui campi `def.preview.searchIn`
 * - attivarsi SOLO se `query` è presente (performance)
 *
 * Scelte progettuali:
 * - se `query` è vuota o non produce condizioni utili => ritorna `null`
 * - campi "normali" => regex case-insensitive
 * - campi "reference" => match per ObjectId (solo se la query è un ObjectId valido)
 */
export function buildSearchFilter(
  def: any,
  query?: string,
): FilterQuery<IAnagraficaDoc> | null {
  const q = (query ?? "").trim();
  if (!q) return null;

  // escape per evitare regex injection / errori con char speciali
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  const searchNormalKeys: FieldKey[] = [];
  const searchReferenceKeys: FieldKey[] = [];

  // separa i campi searchIn in: normali vs reference
  (def.preview.searchIn || []).forEach((k: FieldKey) => {
    const fieldDef = def.fields?.[k];
    if (!fieldDef) return;

    if (isReferenceField(fieldDef)) searchReferenceKeys.push(k);
    else searchNormalKeys.push(k);
  });

  const orConditions: FilterQuery<IAnagraficaDoc>[] = [];

  // campi normali (stringhe, numeri, ecc.) => regex
  if (searchNormalKeys.length) {
    orConditions.push(
      ...searchNormalKeys.map((k) => ({
        [`data.${k}`]: regex,
      })) as any,
    );
  }

  // campi reference => match per ObjectId se query valida
  if (searchReferenceKeys.length && mongoose.isValidObjectId(q)) {
    const oid = new mongoose.Types.ObjectId(q);
    orConditions.push(
      ...searchReferenceKeys.map((k) => ({
        [`data.${k}`]: oid,
      })) as any,
    );
  }

  if (!orConditions.length) return null;

  return { $or: orConditions } as FilterQuery<IAnagraficaDoc>;
}
