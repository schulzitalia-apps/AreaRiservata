// src/components/Store/services/anagraficheService.ts
import { apiClient } from "../api/client";
import {
  AnagraficaPreview,
  AnagraficaFull,
  DocumentLight,
} from "../models/anagrafiche";

export const anagraficheService = {
  list(params: {
    type: string;
    query?: string;
    docType?: string;
    visibilityRole?: string;
    page?: number;
    pageSize?: number;

    /**
     * NEW:
     * sort in API (UX-friendly): updatedAt|createdAt|title0|subtitle0|search0...
     */
    sortKey?: string;
    sortDir?: "asc" | "desc";

    /**
     * NEW:
     * projection dinamica: fields ripetuto o csv (qui usiamo ripetuto)
     */
    fields?: string[];
  }) {
    const {
      type,
      query,
      docType,
      visibilityRole,
      page,
      pageSize,
      sortKey,
      sortDir,
      fields,
    } = params;

    const qs = new URLSearchParams();
    if (query) qs.set("query", query);
    if (docType) qs.set("docType", docType);
    if (visibilityRole) qs.set("visibilityRole", visibilityRole);
    if (page) qs.set("page", String(page));
    if (pageSize) qs.set("pageSize", String(pageSize));

    // NEW: sort
    if (sortKey) qs.set("sortKey", sortKey);
    if (sortDir) qs.set("sortDir", sortDir);

    // NEW: fields projection (ripetuto)
    if (fields?.length) {
      for (const f of fields) qs.append("fields", f);
    }

    return apiClient.get<{
      items: AnagraficaPreview[];
      total: number;
      page: number;
      pageSize: number;

      // opzionali se la API li ritorna (non obbligatori)
      sort?: string;
      fields?: string[];
    }>(`/api/anagrafiche/${type}?${qs.toString()}`);
  },

  getOne(params: { type: string; id: string }) {
    const { type, id } = params;
    return apiClient.get<AnagraficaFull>(
      `/api/anagrafiche/${type}/${id}`,
    );
  },

  create(params: { type: string; payload: any }) {
    const { type, payload } = params;
    return apiClient.post<{ id: string }>(
      `/api/anagrafiche/${type}`,
      payload,
    );
  },

  update(params: { type: string; id: string; data: any }) {
    const { type, id, data } = params;
    return apiClient.patch<{ ok: true }>(
      `/api/anagrafiche/${type}/${id}`,
      data,
    );
  },

  remove(params: { type: string; id: string }) {
    const { type, id } = params;
    return apiClient.delete<{ ok: true }>(
      `/api/anagrafiche/${type}/${id}`,
    );
  },

  uploadAttachment(params: { type: string; id: string; form: FormData }) {
    const { type, id, form } = params;
    return apiClient.postForm<{ document: DocumentLight }>(
      `/api/anagrafiche/${type}/${id}/upload`,
      form,
    );
  },

  deleteAttachment(params: {
    type: string;
    id: string;
    attachmentId: string;
    removeDocument?: boolean;
  }) {
    const { type, id, attachmentId, removeDocument } = params;
    const qs = new URLSearchParams();
    if (removeDocument) qs.set("removeDocument", "1");

    return apiClient.delete<{
      removedAttachment?: { documentId?: string; type?: string };
    }>(
      `/api/anagrafiche/${type}/${id}/attachments/${attachmentId}?${qs.toString()}`,
    );
  },

  /**
   * Batch: dato un elenco di id e un field,
   * ritorna una mappa id -> valore di data[field].
   *
   * La response /field-values che hai mostrato è:
   *   { items: [{ id: string, value: string }] }
   */
  getFieldValues(params: {
    targetSlug: string;
    field: string;
    ids: string[];
  }): Promise<Record<string, string | null>> {
    const { targetSlug, field, ids } = params;

    return apiClient
      .post<{ items: { id: string; value: string | null }[] }>(
        `/api/anagrafiche/${targetSlug}/field-values`,
        { field, ids },
      )
      .then((res) => {
        const map: Record<string, string | null> = {};
        for (const item of res.items ?? []) {
          map[item.id] = item.value ?? null;
        }
        return map;
      });
  },
};
