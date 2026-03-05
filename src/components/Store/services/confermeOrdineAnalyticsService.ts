import { apiClient } from "../api/client";
import type { ConfermeOrdineAnalyticsResponse } from "../models/confermeOrdineAnalytics";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string };
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export const confermeOrdineAnalyticsService = {
  async analytics(params?: { monthsBack?: number }): Promise<ConfermeOrdineAnalyticsResponse> {
    const monthsBack =
      typeof params?.monthsBack === "number" && params.monthsBack > 0
        ? params.monthsBack
        : 24;

    const res = await apiClient.get<ApiResponse<ConfermeOrdineAnalyticsResponse>>(
      `/api/anagrafiche/conferme-ordine/analytics?monthsBack=${encodeURIComponent(monthsBack)}`,
    );

    if (!res.ok) throw new Error(res.error || "INTERNAL_ERROR");
    return res.data;
  },
};