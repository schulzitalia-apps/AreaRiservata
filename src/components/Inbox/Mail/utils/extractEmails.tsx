// src/components/Mail/utils/extractEmails.ts

export function isValidEmail(x: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x || "").trim());
}

export function normalizeEmail(x: string) {
  return String(x || "").trim().toLowerCase();
}

/**
 * Estrae email da un oggetto (profondità limitata) scansionando stringhe.
 * Utile perché i campi dell’anagrafica sono dinamici.
 */
export function extractEmailsDeep(input: any, maxDepth = 6): string[] {
  const out = new Set<string>();
  const seen = new Set<any>();

  const walk = (v: any, depth: number) => {
    if (depth < 0) return;
    if (v == null) return;

    if (typeof v === "string") {
      const s = v.trim();
      if (s && isValidEmail(s)) out.add(normalizeEmail(s));
      return;
    }

    if (typeof v === "number" || typeof v === "boolean") return;

    if (typeof v === "object") {
      if (seen.has(v)) return;
      seen.add(v);

      if (Array.isArray(v)) {
        for (const item of v) walk(item, depth - 1);
        return;
      }

      for (const key of Object.keys(v)) walk(v[key], depth - 1);
    }
  };

  walk(input, maxDepth);
  return Array.from(out);
}

/** Normalizza doc.data / doc.dati */
export function getDocData(doc: any): Record<string, any> {
  if (doc?.data && typeof doc.data === "object") return doc.data;
  if (doc?.dati && typeof doc.dati === "object") return doc.dati;
  return {};
}
