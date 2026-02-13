// PreventiviUtils.ts

export function safeNumber(v: any) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const norm = v.replace(",", ".");
    const parsed = parseFloat(norm);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function clampPct(v: any) {
  const n = safeNumber(v);
  return Math.max(0, Math.min(100, n));
}

export function calcTotale(quantita: any, prezzo: any, scontoPct: any) {
  const q = safeNumber(quantita);
  const p = safeNumber(prezzo);
  const s = clampPct(scontoPct) / 100;
  const lordo = q * p;
  const netto = lordo * (1 - s);
  return Number.isFinite(netto) ? netto : 0;
}

/**
 * IMPORTANTISSIMO:
 * i reference dal backend NON sono sempre stringhe.
 * possono essere numeri, oggetti, wrapper {id}, {value}, ecc.
 */
export function extractRefId(input: any, depth = 0): string | null {
  if (input == null) return null;
  if (depth > 6) return null;

  if (typeof input === "string" || typeof input === "number") return String(input);

  if (Array.isArray(input)) {
    for (const it of input) {
      const got = extractRefId(it, depth + 1);
      if (got) return got;
    }
    return null;
  }

  if (typeof input === "object") {
    const o: any = input;
    if (o.id != null) return extractRefId(o.id, depth + 1);
    if (o._id != null) return extractRefId(o._id, depth + 1);
    if (o.value != null) return extractRefId(o.value, depth + 1);
    if (o.ref != null) return extractRefId(o.ref, depth + 1);
    if (o.documentId != null) return extractRefId(o.documentId, depth + 1);
    if (o.recordId != null) return extractRefId(o.recordId, depth + 1);

    for (const v of Object.values(o)) {
      const got = extractRefId(v, depth + 1);
      if (got) return got;
    }
  }

  return null;
}

export function pickFirst(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj?.[k] != null) return obj[k];
  }
  return undefined;
}
