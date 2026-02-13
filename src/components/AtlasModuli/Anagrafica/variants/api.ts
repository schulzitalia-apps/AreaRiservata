// src/components/Anagrafiche/variants/api.ts
export type FieldOverride = {
  kind: "number" | "datetime" | "text" | "reference";
  format: string;
  unit?: { kind: "prefix" | "suffix"; value: string };
  decimals?: number;
  percentBasis?: "whole" | "fraction";
  currency?: string;
  label?: string;
};

export type VariantConfigDTO = {
  id: string;
  anagraficaSlug: string;
  variantId: string;
  label: string;
  includeFields: string[];
  fieldOverrides: Record<string, FieldOverride>;
  createdAt: string;
  updatedAt: string;
};

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiListVariants(type: string): Promise<VariantConfigDTO[]> {
  const res = await fetch(`/api/anagrafiche/${encodeURIComponent(type)}/variants`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const j = await safeJson(res);
    const msg = j?.message || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  const json = await safeJson(res);

  // ✅ le tue API ritornano: { items }
  if (Array.isArray(json?.items)) return json.items;

  // fallback (se domani cambi)
  if (Array.isArray(json)) return json;

  return [];
}

export async function apiGetVariant(type: string, variantId: string): Promise<VariantConfigDTO | null> {
  const res = await fetch(
    `/api/anagrafiche/${encodeURIComponent(type)}/variants/${encodeURIComponent(variantId)}`,
    {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (res.status === 404) return null;

  if (!res.ok) {
    const j = await safeJson(res);
    const msg = j?.message || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return (await safeJson(res)) as VariantConfigDTO;
}
