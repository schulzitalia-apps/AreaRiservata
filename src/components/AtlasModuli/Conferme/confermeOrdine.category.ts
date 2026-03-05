// src/components/AtlasModuli/ConfermeOrdine/confermeOrdine.category.ts
import { colorForKey, safeStr } from "./confermeOrdine.safe";

export type CatKey = "all" | string;

export type CategoryMeta = Record<string, { label: string; color: string }>;

/**
 * Qui “variantIds” sono i CLIENTI (keys) che arrivano dall’API.
 * Se vuoi label più umane, puoi:
 * - usare già dal backend ragioneSociale come key,
 * - oppure mappare qui id->label (se hai una directory clienti in FE).
 */
export function buildCategoryMetaLikeFromApi(args: {
  keys: string[];
}): CategoryMeta {
  const out: CategoryMeta = {};
  for (const k of args.keys || []) {
    const key = safeStr(k);
    if (!key) continue;
    out[key] = { label: key, color: colorForKey(key) };
  }
  return out;
}

export function buildCategoryTabItems(args: {
  keys: string[];
  categoryMetaLike: CategoryMeta;
}): { key: CatKey; label: string; color?: string }[] {
  const keys = [...(args.keys || [])].sort((a, b) => String(a).localeCompare(String(b)));
  return [
    { key: "all" as const, label: "Tutte", color: "#5750F1" },
    ...keys.map((k) => ({
      key: k as CatKey,
      label: args.categoryMetaLike[k]?.label ?? k,
      color: args.categoryMetaLike[k]?.color ?? colorForKey(k),
    })),
  ];
}