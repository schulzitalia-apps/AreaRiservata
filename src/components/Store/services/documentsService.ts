// src/store/services/documentsService.ts
import { apiClient } from "../api/client";
import {
  DocumentItem,
  DocumentCategory,
  UploadDocumentPayload,
} from "../models/documents";

const qsCat = (category?: "all" | DocumentCategory) =>
  category && category !== "all"
    ? `?category=${encodeURIComponent(category)}`
    : "";

export const documentsService = {
  /** SOLO MIE (privati + eventuali pubblici creati da me) con filtro categoria */
  listMine(category?: "all" | DocumentCategory) {
    return apiClient.get<{ items: DocumentItem[] }>(
      `/api/documents/mine${qsCat(category)}`
    );
  },

  /** Tutti i PUBBLICI, con filtro categoria */
  listPublic(category?: "all" | DocumentCategory) {
    return apiClient.get<{ items: DocumentItem[] }>(
      `/api/documents/public${qsCat(category)}`
    );
  },

  /** “Mostra tutto” = miei + pubblici (merge per id), con filtro categoria */
  async listAllForUser(category?: "all" | DocumentCategory) {
    const [mine, pub] = await Promise.all([
      this.listMine(category),
      this.listPublic(category),
    ]);

    const map = new Map<string, DocumentItem>();
    [...mine.items, ...pub.items].forEach((d) => map.set(d.id, d));

    return { items: Array.from(map.values()) };
  },

  /** ADMIN: lista custom (debugger admin) */
  listAdmin(params: { scope?: "all" | "public" | "byOwner"; ownerId?: string }) {
    const { scope = "all", ownerId } = params;
    const qs = new URLSearchParams();
    qs.set("scope", scope);
    if (scope === "byOwner" && ownerId) qs.set("ownerId", ownerId);

    return apiClient.get<{ items: DocumentItem[] }>(
      `/api/admin/documents/list?${qs.toString()}`
    );
  },

  /** UPLOAD (invia anche la category selezionata) */
  upload(payload: UploadDocumentPayload) {
    const fd = new FormData();
    fd.append("file", payload.file, payload.file.name);
    if (payload.title) fd.append("title", payload.title);
    if (payload.visibility) fd.append("visibility", payload.visibility);
    if (payload.summary !== undefined && payload.summary !== null) {
      fd.append("summary", payload.summary);
    }
    if (payload.ownerId) fd.append("ownerId", payload.ownerId);
    if (payload.category) fd.append("category", payload.category);

    return apiClient.postForm<{ document: DocumentItem }>(
      "/api/documents/upload",
      fd
    );
  },

  /** DELETE */
  async remove(id: string) {
    await apiClient.delete<unknown>(`/api/documents/${id}`);
  },
};
