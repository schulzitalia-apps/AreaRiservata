// Store/services/azioniService.ts

import { apiClient } from "../api/client";
import type { AzionePreview } from "../models/azioni";

export const azioniService = {
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

    // 👇 usa l’API dedicata con motore di visibilità
    return apiClient.get<{ items: AzionePreview[] }>(
      `/api/eventi/${type}/filter?${qs.toString()}`,
    );
  },
};
