// src/components/Store/services/devBoardService.ts
import { apiClient } from "../api/client";
import {
  DevBoardItem,
  DevItemCategory,
  DevItemStatus,
} from "../models/devBoard";

export const devBoardService = {
  list(params: { category?: DevItemCategory; status?: DevItemStatus } = {}) {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.status) qs.set("status", params.status);

    return apiClient.get<{ items: DevBoardItem[] }>(
      `/api/admin/dev-board?${qs.toString()}`
    );
  },

  create(payload: {
    category: DevItemCategory;
    title: string;
    description: string;
    versionTag?: string | null;
  }) {
    return apiClient.post<DevBoardItem>(`/api/admin/dev-board`, payload);
  },

  async update(args: { id: string; data: Partial<DevBoardItem> }) {
    const { id, data } = args;
    // ignoriamo la risposta, ci basta sapere che è ok
    await apiClient.patch<DevBoardItem>(`/api/admin/dev-board/${id}`, data);
  },

  async remove(id: string) {
    await apiClient.delete<unknown>(`/api/admin/dev-board/${id}`);
  },
};
