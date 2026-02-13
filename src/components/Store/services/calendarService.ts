// src/store/services/calendarService.ts
import { apiClient } from "../api/client";
import { CalendarEvent, Scope } from "../models/calendar";

export const calendarService = {

  list(params: { from: string; to: string; scope: Scope }) {
    const qs = new URLSearchParams({
      from: params.from,
      to: params.to,
      scope: params.scope,
    });
    return apiClient.get<{ events: CalendarEvent[] }>(
      `/api/calendar/events?${qs.toString()}`
    );
  },

  create(payload: {
    title: string;
    notes?: string;
    visibility: Scope;
    dateStart: string;
    dateEnd?: string;
    timeStart?: string;
    timeEnd?: string;
  }) {
    return apiClient.post<{ event: CalendarEvent }>(
      `/api/calendar/events`,
      payload
    );
  },

  update(payload: {
    id: string;
    data: Partial<{
      title: string;
      notes: string;
      visibility: Scope;
      dateStart: string;
      dateEnd: string;
      timeStart: string;
      timeEnd: string;
    }>;
  }) {
    return apiClient.patch<{ event: CalendarEvent }>(
      `/api/calendar/events`,
      { id: payload.id, ...payload.data }
    );
  },

  remove(id: string) {
    return apiClient.delete<void>(`/api/calendar/events?id=${id}`);
  },
};
