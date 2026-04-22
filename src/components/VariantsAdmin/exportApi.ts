import type {
  CreateExportVariantPayload,
  ExportVariantConfigDTO,
  UpdateExportVariantPayload,
} from "./exportTypes";

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let msg = `HTTP_${res.status}`;
    try {
      const j = await res.json();
      msg = j?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return (await res.json()) as T;
}

function withExportScope(path: string) {
  return `${path}?scope=export`;
}

export async function apiListExportVariants(anagraficaSlug: string) {
  const url = withExportScope(
    `/api/anagrafiche/${encodeURIComponent(anagraficaSlug)}/variants`,
  );
  const data = await http<{ items: ExportVariantConfigDTO[] }>(url);
  return data.items || [];
}

export async function apiCreateExportVariant(
  anagraficaSlug: string,
  payload: CreateExportVariantPayload,
) {
  const url = withExportScope(
    `/api/anagrafiche/${encodeURIComponent(anagraficaSlug)}/variants`,
  );
  return await http<ExportVariantConfigDTO>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateExportVariant(
  anagraficaSlug: string,
  variantId: string,
  payload: UpdateExportVariantPayload,
) {
  const url = withExportScope(
    `/api/anagrafiche/${encodeURIComponent(anagraficaSlug)}/variants/${encodeURIComponent(variantId)}`,
  );
  return await http<ExportVariantConfigDTO>(url, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteExportVariant(
  anagraficaSlug: string,
  variantId: string,
) {
  const url = withExportScope(
    `/api/anagrafiche/${encodeURIComponent(anagraficaSlug)}/variants/${encodeURIComponent(variantId)}`,
  );
  return await http<{ ok: boolean }>(url, { method: "DELETE" });
}
