// src/server-utils/service/Anagrafiche/list/builders/sort.ts

/**
 * EVOLVE ATLAS — Builder Sort (uniforme + whitelistata)
 * ----------------------------------------------------
 * Questo builder produce un sort Mongo/Mongoose “sicuro”:
 * - nessun sort libero (evita sort su campi non indicizzati)
 * - supporta:
 *   - sort temporali (updatedAt / createdAt)
 *   - sort alfabetici/numerici sui campi preview:
 *       title / subtitle / searchIn
 *
 * Motivazione:
 * - i campi preview vengono indicizzati automaticamente dal model (ensureIndexes)
 * - quindi sono candidati naturali per sort “operativi”
 *
 * Nota importante:
 * - sort su `data.<campo>` funziona bene SOLO se quel campo è indicizzato
 * - qui garantiamo che si possa ordinare solo su campi che il def dichiara in preview
 *
 * Regola tie-break:
 * - aggiungiamo sempre `_id: -1` come tie-break per stabilità (paginazione offset/cursor)
 */

export type ListSortKey =
  | "updatedAt_desc"
  | "updatedAt_asc"
  | "createdAt_desc"
  | "createdAt_asc"
  | `preview:${string}:asc`
  | `preview:${string}:desc`;

function buildPreviewSortableKeys(def: any): Set<string> {
  const out = new Set<string>();

  // title/subtitle/searchIn => tutto ciò che è “preview field”
  for (const k of def.preview?.title || []) out.add(String(k));
  for (const k of def.preview?.subtitle || []) out.add(String(k));
  for (const k of def.preview?.searchIn || []) out.add(String(k));

  return out;
}

export function buildListSort(def: any, sortKey?: ListSortKey) {
  const key = sortKey || "updatedAt_desc";

  // 1) sort temporali (core)
  if (key === "updatedAt_desc") return { updatedAt: -1 as const, _id: -1 as const };
  if (key === "updatedAt_asc") return { updatedAt: 1 as const, _id: -1 as const };
  if (key === "createdAt_desc") return { createdAt: -1 as const, _id: -1 as const };
  if (key === "createdAt_asc") return { createdAt: 1 as const, _id: -1 as const };

  // 2) sort su campi preview (data.<campo>)
  // formato: preview:<field>:asc|desc
  if (key.startsWith("preview:")) {
    const parts = key.split(":"); // ["preview", "<field>", "asc|desc"]
    const field = String(parts[1] || "").trim();
    const dir = parts[2] === "asc" ? 1 : -1;

    const allowed = buildPreviewSortableKeys(def);

    // fallback safe: se il campo non è tra quelli preview => non ordiniamo su data
    if (!field || !allowed.has(field)) {
      return { updatedAt: -1 as const, _id: -1 as const };
    }

    return { [`data.${field}`]: dir as 1 | -1, _id: -1 as const };
  }

  // fallback safe
  return { updatedAt: -1 as const, _id: -1 as const };
}
