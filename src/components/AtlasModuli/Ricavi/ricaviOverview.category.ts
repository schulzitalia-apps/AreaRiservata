// src/components/AtlasModuli/Spese/speseOverview.category.ts
import { colorForKey, safeStr } from "./ricaviOverview.safe";

export type VariantItem = {
  variantId: string;
  label: string;
  includeFields?: string[];
  fieldOverrides?: Record<string, any>;
};

export type CatKey = "all" | string;

export type CategoryMeta = Record<string, { label: string; color: string }>;

export function buildCategoryMetaLike(args: {
  baseMeta: CategoryMeta; // es. CATEGORY_META del mock
  useMock: boolean;
  variants: VariantItem[];
}): CategoryMeta {
  const base = { ...args.baseMeta };
  if (args.useMock) return base;

  const out: CategoryMeta = { ...base };

  for (const v of args.variants || []) {
    const vid = safeStr(v.variantId);
    if (!vid) continue;

    if (out[vid]) {
      out[vid] = {
        label: v.label ? safeStr(v.label) : out[vid].label,
        color: out[vid].color,
      };
    } else {
      out[vid] = {
        label: v.label ? safeStr(v.label) : vid,
        color: colorForKey(vid),
      };
    }
  }

  return out;
}

export function buildCategoryTabItems(args: {
  useMock: boolean;
  baseMeta: CategoryMeta;
  variants: VariantItem[];
  categoryMetaLike: CategoryMeta;
}): { key: CatKey; label: string; color?: string }[] {
  if (args.useMock) {
    const keys = Object.keys(args.baseMeta);
    return [
      { key: "all" as const, label: "Tutte", color: "#5750F1" },
      ...keys.map((k) => ({
        key: k as CatKey,
        label: args.baseMeta[k]?.label ?? k,
        color: args.baseMeta[k]?.color ?? colorForKey(k),
      })),
    ];
  }

  return [
    { key: "all" as const, label: "Tutte", color: "#5750F1" },
    ...args.variants.map((v) => ({
      key: v.variantId as CatKey,
      label: v.label || v.variantId,
      color: args.categoryMetaLike[v.variantId]?.color ?? colorForKey(v.variantId),
    })),
  ];
}
