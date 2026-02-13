import type {
  CreateVariantPayload,
  UpdateVariantPayload,
  VariantConfigDTO,
} from "./types";

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

export async function apiListVariants(anagraficaSlug: string) {
  const url = `/api/anagrafiche/${encodeURIComponent(anagraficaSlug)}/variants`;
  const data = await http<{ items: VariantConfigDTO[] }>(url);
  return data.items || [];
}

export async function apiGetVariant(anagraficaSlug: string, variantId: string) {
  const url = `/api/anagrafiche/${encodeURIComponent(
    anagraficaSlug,
  )}/variants/${encodeURIComponent(variantId)}`;
  return await http<VariantConfigDTO>(url);
}

export async function apiCreateVariant(
  anagraficaSlug: string,
  payload: CreateVariantPayload,
) {
  const url = `/api/anagrafiche/${encodeURIComponent(anagraficaSlug)}/variants`;
  return await http<VariantConfigDTO>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateVariant(
  anagraficaSlug: string,
  variantId: string,
  payload: UpdateVariantPayload,
) {
  const url = `/api/anagrafiche/${encodeURIComponent(
    anagraficaSlug,
  )}/variants/${encodeURIComponent(variantId)}`;
  return await http<VariantConfigDTO>(url, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteVariant(anagraficaSlug: string, variantId: string) {
  const url = `/api/anagrafiche/${encodeURIComponent(
    anagraficaSlug,
  )}/variants/${encodeURIComponent(variantId)}`;
  return await http<{ ok: boolean }>(url, { method: "DELETE" });
}
