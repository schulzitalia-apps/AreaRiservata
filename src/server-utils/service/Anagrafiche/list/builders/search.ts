// src/server-utils/service/Anagrafiche/list/builders/search.ts
import mongoose from "mongoose";
import type { FilterQuery } from "mongoose";

import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import { isReferenceField } from "@/config/anagrafiche.fields.catalog";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/**
 * Prova a interpretare la query come numero "intero" (tutta la stringa).
 * Supporta:
 * - interi/float
 * - virgola decimale
 * - spazi (rimossi)
 *
 * Non fa estrazione da testo: o è un numero "pulito", o null.
 */
function tryParseWholeNumber(raw: string): number | null {
  const s0 = (raw ?? "").trim();
  if (!s0) return null;

  const cleaned = s0.replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

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
 * - campi "number" => match ESATTO (solo se la query è interamente numerica)
 *   + fallback string equality (legacy)
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
  const searchNumberKeys: FieldKey[] = [];
  const searchReferenceKeys: FieldKey[] = [];

  // separa i campi searchIn in: normali vs number vs reference
  (def.preview.searchIn || []).forEach((k: FieldKey) => {
    const fieldDef = def.fields?.[k];
    if (!fieldDef) return;

    if (isReferenceField(fieldDef)) searchReferenceKeys.push(k);
    else if (fieldDef.type === "number") searchNumberKeys.push(k);
    else searchNormalKeys.push(k);
  });

  const orConditions: FilterQuery<IAnagraficaDoc>[] = [];

  // campi normali (stringhe, ecc.) => regex
  if (searchNormalKeys.length) {
    orConditions.push(
      ...searchNormalKeys.map((k) => ({
        [`data.${k}`]: regex,
      })) as any,
    );
  }

  // campi number => match ESATTO se la query è interamente numerica
  // + fallback string equality per casi legacy
  if (searchNumberKeys.length) {
    const qNum = tryParseWholeNumber(q);

    if (qNum !== null) {
      orConditions.push(
        ...searchNumberKeys.map((k) => ({
          [`data.${k}`]: qNum,
        })) as any,
      );
    }

    // fallback legacy (numero salvato come stringa)
    orConditions.push(
      ...searchNumberKeys.map((k) => ({
        [`data.${k}`]: q,
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
