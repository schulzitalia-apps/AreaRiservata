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
  baseMeta: CategoryMeta;
  variants: VariantItem[];
}): CategoryMeta {
  const out: CategoryMeta = { ...args.baseMeta };

  for (const variant of args.variants || []) {
    const variantId = safeStr(variant.variantId);
    if (!variantId) continue;

    out[variantId] = {
      label: safeStr(variant.label) || out[variantId]?.label || variantId,
      color: out[variantId]?.color ?? colorForKey(variantId),
    };
  }

  return out;
}

export function buildCategoryTabItems(args: {
  variants: VariantItem[];
  categoryMetaLike: CategoryMeta;
}): { key: CatKey; label: string; color?: string }[] {
  return [
    { key: "all", label: "Tutte", color: "#5750F1" },
    ...args.variants.map((variant) => ({
      key: variant.variantId,
      label: variant.label || variant.variantId,
      color: args.categoryMetaLike[variant.variantId]?.color ?? colorForKey(variant.variantId),
    })),
  ];
}
