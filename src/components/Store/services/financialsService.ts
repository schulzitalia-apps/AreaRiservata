import { apiClient } from "../api/client";
import type {
  SpeseAnalyticsResponse,
  RicaviAnalyticsResponse,
} from "../models/financials";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string };
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export const financialsService = {
  async speseAnalytics(params?: { monthsBack?: number }): Promise<SpeseAnalyticsResponse> {
    const monthsBack =
      typeof params?.monthsBack === "number" && params.monthsBack > 0
        ? params.monthsBack
        : 24;

    const res = await apiClient.get<ApiResponse<SpeseAnalyticsResponse>>(
      `/api/anagrafiche/spese/analytics?monthsBack=${encodeURIComponent(monthsBack)}`,
    );

    if (!res.ok) throw new Error(res.error || "INTERNAL_ERROR");
    return res.data;
  },

  async ricaviAnalytics(params?: { monthsBack?: number }): Promise<RicaviAnalyticsResponse> {
    const monthsBack =
      typeof params?.monthsBack === "number" && params.monthsBack > 0
        ? params.monthsBack
        : 24;

    const res = await apiClient.get<ApiResponse<RicaviAnalyticsResponse>>(
      `/api/anagrafiche/ricavi/analytics?monthsBack=${encodeURIComponent(monthsBack)}`,
    );

    if (!res.ok) throw new Error(res.error || "INTERNAL_ERROR");
    return res.data;
  },
};
