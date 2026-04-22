export type ExportFormat = "csv" | "xls";
export type ExportSortDir = "asc" | "desc";

export type ExportVariantConfigDTO = {
  id: string;
  anagraficaSlug: string;
  variantId: string;
  label: string;
  format: ExportFormat;
  includeFields: string[];
  referenceExpansions: Record<string, string[]>;
  filterDateField: string | null;
  filterSelectField: string | null;
  sortDateField: string | null;
  sortDir: ExportSortDir;
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

export async function apiListExportVariants(type: string): Promise<ExportVariantConfigDTO[]> {
  const res = await fetch(
    `/api/anagrafiche/${encodeURIComponent(type)}/variants?scope=export`,
    {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await safeJson(res);
    const message = body?.message || `HTTP_${res.status}`;
    throw new Error(message);
  }

  const json = await safeJson(res);
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
}
