// Store/services/eventiService.ts
import { apiClient } from "../api/client";
import {
  EventoPreview,
  EventoFull,
  DocumentLight,
} from "../models/eventi";
import { AnagraficaFull } from "@/components/Store/models/anagrafiche";

export const eventiService = {
  list(params: {
    type: string;
    query?: string;
    visibilityRole?: string;
    timeFrom?: string;
    timeTo?: string;
    anagraficaType?: string;
    anagraficaId?: string;
    gruppoType?: string;
    gruppoId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const {
      type,
      query,
      visibilityRole,
      timeFrom,
      timeTo,
      anagraficaType,
      anagraficaId,
      gruppoType,
      gruppoId,
      page,
      pageSize,
    } = params;

    const qs = new URLSearchParams();
    if (query) qs.set("query", query);
    if (visibilityRole) qs.set("visibilityRole", visibilityRole);
    if (timeFrom) qs.set("timeFrom", timeFrom);
    if (timeTo) qs.set("timeTo", timeTo);
    if (anagraficaType) qs.set("anagraficaType", anagraficaType);
    if (anagraficaId) qs.set("anagraficaId", anagraficaId);
    if (gruppoType) qs.set("gruppoType", gruppoType);
    if (gruppoId) qs.set("gruppoId", gruppoId);
    if (page) qs.set("page", String(page));
    if (pageSize) qs.set("pageSize", String(pageSize));

    return apiClient.get<{
      items: EventoPreview[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/api/eventi/${type}?${qs.toString()}`);
  },

  getOne(params: { type: string; id: string }) {
    const { type, id } = params;

    return apiClient
      .get<{ evento: EventoFull }>(`/api/eventi/${type}/${id}`)
      .then((res) => res.evento);
  },

  create(params: { type: string; payload: any }) {
    const { type, payload } = params;
    return apiClient.post<{ id: string }>(
      `/api/eventi/${type}`,
      payload,
    );
  },

  update(params: { type: string; id: string; data: any }) {
    const { type, id, data } = params;
    return apiClient.put<{ ok: true }>(
      `/api/eventi/${type}/${id}`,
      data,
    );
  },

  remove(params: { type: string; id: string }) {
    const { type, id } = params;
    return apiClient.delete<{ ok: true }>(
      `/api/eventi/${type}/${id}`,
    );
  },

  uploadAttachment(params: { type: string; id: string; form: FormData }) {
    const { type, id, form } = params;
    return apiClient.postForm<{ document: DocumentLight }>(
      `/api/eventi/${type}/${id}/upload`,
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
      `/api/eventi/${type}/${id}/attachments/${attachmentId}?${qs.toString()}`,
    );
  },
};
