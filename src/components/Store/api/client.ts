// src/components/Store/api/client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData =
    typeof FormData !== 'undefined' && init.body instanceof FormData;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(!isFormData && init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get:  <T>(path: string) => apiFetch<T>(path),

  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put:  <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  patch:<T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete:<T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),

  postForm:<T>(path: string, form: FormData) =>
    apiFetch<T>(path, { method: 'POST', body: form }),
};
