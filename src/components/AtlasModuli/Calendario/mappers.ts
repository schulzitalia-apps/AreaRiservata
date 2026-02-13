// src/components/AtlasModuli/Calendario/mappers.ts
import type {
  EventoPreview,
  EventoFull,
} from "@/components/Store/models/eventi";
import type { CalendarEventVM } from "./types";

// Nota: CalendarEventVM ora espone direttamente visibilityRole (string | null),
// quindi NON facciamo più mapping "public/private" qui.

export function fromEventoPreview(
  ev: EventoPreview,
): CalendarEventVM | null {
  if (!ev.startAt || !ev.endAt) return null;

  return {
    id: ev.id,
    title: ev.displayName,
    subtitle: ev.subtitle,
    notes: null, // EventoPreview non ha notes, quindi null
    start: ev.startAt,
    end: ev.endAt,
    allDay: ev.timeKind === "point" ? false : false,
    timeKind: ev.timeKind,
    visibilityRole: ev.visibilityRole ?? null,
    // non abbiamo info di tipo qui: valori generici di fallback
    typeSlug: "generic",
    typeLabel: "Evento",
  };
}

export function fromEventoFull(ev: EventoFull): CalendarEventVM | null {
  if (!ev.startAt || !ev.endAt) return null;

  const data = ev.data || {};

  return {
    id: ev.id,
    title:
      (data.title as string) ||
      (data.nome as string) ||
      "Evento",
    subtitle: (data.subtitle as string) || null,
    notes: (data.note as string) || null,
    start: ev.startAt,
    end: ev.endAt,
    allDay: !!ev.allDay,
    timeKind: ev.timeKind,
    visibilityRole: ev.visibilityRole ?? null,
    typeSlug: "generic",
    typeLabel: "Evento",
  };
}
