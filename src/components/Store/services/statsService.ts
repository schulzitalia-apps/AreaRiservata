import { apiClient } from "../api/client";
import type { AnagraficheFieldStatsResponse } from "../models/stats";

export const statsService = {
  /**
   * Stats ACL-aware per anagrafiche su un singolo campo.
   * Backend: POST /api/stats/anagrafiche/:type/field
   *
   * Il backend deduce kind dal registry, quindi qui NON lo passiamo.
   */
  anagraficheField(params: {
    type: string;
    fieldKey: string;
    pivot: string | number;
  }) {
    const { type, fieldKey, pivot } = params;

    return apiClient.post<AnagraficheFieldStatsResponse>(
      `/api/stats/anagrafiche/${encodeURIComponent(type)}/field`,
      { fieldKey, pivot },
    );
  },
};
