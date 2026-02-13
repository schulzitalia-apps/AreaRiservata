import mongoose from "mongoose";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import {
  isReferenceField,
  isReferenceMultiField,
  type FieldDef,
} from "@/config/anagrafiche.fields.catalog";

/**
 * Builder: data patch ops ($set/$unset)
 * ----------------------------------------------------
 * Casting con controllo del type del field input:
 * - usa `FieldDef.type` (il tuo FieldInputType)
 * - applica regole coerenti per ogni tipo
 *
 * Semantica Atlas:
 * - operiamo SOLO sulle chiavi presenti nell'input (delta)
 * - vuoto => $unset (chiave rimossa, sparse)
 * - valorizzato => $set con casting
 */

type PatchOps = {
  $set?: Record<string, any>;
  $unset?: Record<string, any>;
};

function isEmptyValue(v: any): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function toNumber(v: any): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toBoolean(v: any): boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
    return null;
  }
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
    if (s === "false" || s === "0" || s === "no" || s === "n") return false;
  }
  return null;
}

function toDate(v: any): Date | null {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toObjectId(v: any): mongoose.Types.ObjectId | null {
  if (v === undefined || v === null) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (typeof v === "string" && mongoose.isValidObjectId(v)) {
    return new mongoose.Types.ObjectId(v);
  }
  return null;
}

function toStringClean(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toStringArray(v: any): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((x) => toStringClean(x))
    .filter(Boolean) as string[];
  return out.length ? out : null;
}

function toNumberArray(v: any): number[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((x) => toNumber(x))
    .filter((x): x is number => typeof x === "number");
  return out.length ? out : null;
}

function toObjectIdArray(v: any): mongoose.Types.ObjectId[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((x) => toObjectId(x))
    .filter((x): x is mongoose.Types.ObjectId => !!x);
  return out.length ? out : null;
}

function toRangeNumber(v: any): { from: number; to: number } | null {
  if (!v || typeof v !== "object") return null;
  const from = toNumber((v as any).from);
  const to = toNumber((v as any).to);
  if (from === null || to === null) return null;
  return { from, to };
}

function toRangeDate(v: any): { start: Date; end: Date } | null {
  if (!v || typeof v !== "object") return null;
  const start = toDate((v as any).start);
  const end = toDate((v as any).end);
  if (!start || !end) return null;
  return { start, end };
}

function toGeoPoint(v: any): { lat: number; lng: number } | null {
  if (!v || typeof v !== "object") return null;
  const lat = toNumber((v as any).lat);
  const lng = toNumber((v as any).lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function toGeoPointArray(v: any): { lat: number; lng: number }[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((p) => toGeoPoint(p))
    .filter((x): x is { lat: number; lng: number } => !!x);
  return out.length ? out : null;
}

function toPairNumber(v: any): { a: number; b: number } | null {
  if (!v || typeof v !== "object") return null;
  const a = toNumber((v as any).a);
  const b = toNumber((v as any).b);
  if (a === null || b === null) return null;
  return { a, b };
}

function toLabelValuePairs(v: any): { label: string; value: string }[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const label = toStringClean((row as any).label);
      const value = toStringClean((row as any).value);
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean) as { label: string; value: string }[];
  return out.length ? out : null;
}

function toKeyValueNumber(v: any): { key: string; value: number }[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const key = toStringClean((row as any).key);
      const value = toNumber((row as any).value);
      if (!key || value === null) return null;
      return { key, value };
    })
    .filter(Boolean) as { key: string; value: number }[];
  return out.length ? out : null;
}

function toAddress(v: any): Record<string, any> | null {
  if (!v || typeof v !== "object") return null;

  // Manteniamo il modello elastico ma pulito:
  // - prendiamo solo chiavi note
  // - puliamo stringhe
  const street = toStringClean((v as any).street);
  const city = toStringClean((v as any).city);
  const zip = toStringClean((v as any).zip);
  const province = toStringClean((v as any).province);
  const country = toStringClean((v as any).country);
  const extra = toStringClean((v as any).extra);

  // Se è tutto vuoto => null (unset)
  if (!street && !city && !zip && !province && !country && !extra) return null;

  return {
    ...(street ? { street } : {}),
    ...(city ? { city } : {}),
    ...(zip ? { zip } : {}),
    ...(province ? { province } : {}),
    ...(country ? { country } : {}),
    ...(extra ? { extra } : {}),
  };
}

/**
 * Casting per tipo “serio”
 */
function castByFieldType(fieldDef: FieldDef | undefined, rawValue: any): any | null {
  // se vuoto => null (chiamante farà unset / omit)
  if (isEmptyValue(rawValue)) return null;

  // Campo non definito nel registry:
  // - manteniamo elasticità: settiamo “as-is”
  // - MA: se è stringa vuota/whitespace viene già filtrata sopra
  if (!fieldDef) return rawValue;

  // Reference singola / multipla (type guard)
  if (isReferenceField(fieldDef)) {
    return toObjectId(rawValue);
  }
  if (isReferenceMultiField(fieldDef)) {
    return toObjectIdArray(rawValue);
  }

  switch (fieldDef.type) {
    case "text":
    case "email":
    case "tel":
    case "textarea":
    case "select": {
      return toStringClean(rawValue);
    }

    case "multiselect":
    case "labelArray": {
      return toStringArray(rawValue);
    }

    case "number": {
      return toNumber(rawValue);
    }

    case "numberArray": {
      return toNumberArray(rawValue);
    }

    case "boolean": {
      return toBoolean(rawValue);
    }

    case "date": {
      return toDate(rawValue);
    }

    case "rangeNumber": {
      return toRangeNumber(rawValue);
    }

    case "rangeDate": {
      return toRangeDate(rawValue);
    }

    case "geoPoint": {
      return toGeoPoint(rawValue);
    }

    case "geoPointArray": {
      return toGeoPointArray(rawValue);
    }

    case "pairNumber": {
      return toPairNumber(rawValue);
    }

    case "labelValuePairs": {
      return toLabelValuePairs(rawValue);
    }

    case "keyValueNumber": {
      return toKeyValueNumber(rawValue);
    }

    case "address": {
      return toAddress(rawValue);
    }

    // reference/referenceMulti già gestiti sopra
    case "reference":
    case "referenceMulti": {
      return rawValue;
    }

    default: {
      // exhaustive fallback: non castiamo, ma non buttiamo via
      return rawValue;
    }
  }
}

/**
 * buildDataPatchOps
 * -----------------
 * Produce update ops SOLO per le chiavi presenti nell'input.
 */
export function buildDataPatchOps(
  slug: AnagraficaTypeSlug,
  input?: Record<string, any>,
): PatchOps | null {
  if (!input || typeof input !== "object") return null;

  const def = getAnagraficaDef(slug);

  const set: Record<string, any> = {};
  const unset: Record<string, any> = {};

  for (const [key, rawValue] of Object.entries(input)) {
    const fieldDef = (def?.fields as any)?.[key] as FieldDef | undefined;

    const casted = castByFieldType(fieldDef, rawValue);

    // Regola Atlas: se null => unset (chiave rimossa)
    if (casted === null) {
      unset[`data.${key}`] = 1;
      continue;
    }

    // Se casting ritorna undefined (non dovrebbe), fallback => unset
    if (typeof casted === "undefined") {
      unset[`data.${key}`] = 1;
      continue;
    }

    set[`data.${key}`] = casted;
  }

  const out: PatchOps = {};
  if (Object.keys(set).length) out.$set = set;
  if (Object.keys(unset).length) out.$unset = unset;

  return Object.keys(out).length ? out : null;
}

/* -------------------------------------------------------------------------- */
/*                                    CREATE                                  */
/* -------------------------------------------------------------------------- */

/**
 * buildCreateDataObject
 * ---------------------
 * Create NON ha bisogno di $set/$unset: dobbiamo costruire direttamente il blob `data`.
 *
 * Regole:
 * - operiamo SOLO sulle chiavi presenti nell'input (delta di create)
 * - vuoto => NON scrivere la chiave (sparse)
 * - valorizzato => scrivi la chiave castata (stesso casting serio)
 *
 * Perché così:
 * - evita di salvare chiavi vuote (""/null/[]) nel documento
 * - mantiene gli indici su data.<campo> leggeri (i missing non contribuiscono)
 */
export function buildCreateDataObject(
  slug: AnagraficaTypeSlug,
  input?: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = {};
  if (!input || typeof input !== "object") return out;

  const def = getAnagraficaDef(slug);

  for (const [key, rawValue] of Object.entries(input)) {
    const fieldDef = (def?.fields as any)?.[key] as FieldDef | undefined;

    const casted = castByFieldType(fieldDef, rawValue);

    // Sparse: se null/undefined => omit
    if (casted === null || typeof casted === "undefined") continue;

    out[key] = casted;
  }

  return out;
}
