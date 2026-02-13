// src/components/Store/services/notificheService.ts

import { apiClient } from "../api/client";
import type { NotificaPreferenzaPreview } from "../models/notifiche";

export const notificheService = {
  listPreferenze(params?: { types?: string[]; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.types?.length) qs.set("types", params.types.join(","));

    const tail = qs.toString();
    return apiClient.get<{ items: NotificaPreferenzaPreview[] }>(
      `/api/notifiche/preferenze${tail ? `?${tail}` : ""}`,
    );
  },
};
