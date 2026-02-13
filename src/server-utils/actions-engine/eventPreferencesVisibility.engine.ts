// src/server-utils/actions-engine/eventPreferencesVisibility.engine.ts

import type { IEventoDoc } from "@/server-utils/models/evento.schema";
import type {
  EventoNotificationPreference,
  PrefVisibilityMode,
} from "@/config/notifiche.eventi.preferences";

function getBaseDate(
  evento: Pick<IEventoDoc, "startAt" | "endAt">,
  pref: EventoNotificationPreference,
): Date | null {
  const base = pref.base ?? "startAt";
  const raw =
    base === "endAt"
      ? (evento.endAt ?? evento.startAt)
      : (evento.startAt ?? evento.endAt);

  if (!raw) return null;

  const d = new Date(raw as any);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function isEventoVisibleByPreferencesNow(
  evento: Pick<IEventoDoc, "startAt" | "endAt" | "data">,
  pref: EventoNotificationPreference,
  now: Date = new Date(),
): { visible: boolean; state?: "UPCOMING" | "PAST" } {
  if (!pref.enabled) return { visible: false };

  // filtro stato evento: data.stato
  const statoRaw = (evento as any)?.data?.stato;
  const stato = statoRaw ? String(statoRaw) : null;
  if (stato && pref.excludeStatuses?.includes(stato)) return { visible: false };

  // requireFields: data.<k> deve esistere e non essere vuoto
  if (pref.requireFields?.length) {
    for (const k of pref.requireFields) {
      const v = (evento as any)?.data?.[k];
      if (v === null || v === undefined || String(v).trim() === "") {
        return { visible: false };
      }
    }
  }

  const baseDate = getBaseDate(evento, pref);
  if (!baseDate) return { visible: false };

  const mode = (pref.mode ?? "FINESTRA") as PrefVisibilityMode;

  const nowMs = now.getTime();
  const baseMs = baseDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  const beforeDays = Number(pref.beforeDays ?? 0) || 0;
  const afterDaysRaw = Number(pref.afterDays ?? 0) || 0;
  const stopAfterDays =
    pref.stopAfterDays !== undefined ? Number(pref.stopAfterDays) || 0 : null;

  const afterDays =
    stopAfterDays !== null ? Math.min(afterDaysRaw, stopAfterDays) : afterDaysRaw;

  const startWindow = baseMs - beforeDays * dayMs;
  const endWindow = baseMs + afterDays * dayMs;

  if (mode === "SEMPRE") {
    return { visible: true, state: nowMs >= baseMs ? "PAST" : "UPCOMING" };
  }

  if (mode === "SOLO_PRIMA") {
    const ok = nowMs >= startWindow && nowMs < baseMs;
    return { visible: ok, state: "UPCOMING" };
  }

  if (mode === "SOLO_DOPO") {
    const ok = nowMs > baseMs && nowMs <= endWindow;
    return { visible: ok, state: "PAST" };
  }

  // FINESTRA
  const ok = nowMs >= startWindow && nowMs <= endWindow;
  if (!ok) return { visible: false };

  // se siamo dopo base date
  if (nowMs >= baseMs) {
    if (pref.includePast) {
      const pastDays = Number(pref.pastDays ?? afterDays ?? 0) || 0;
      const pastLimit = baseMs + pastDays * dayMs;
      return { visible: nowMs <= pastLimit, state: "PAST" };
    }
    return { visible: true, state: "PAST" };
  }

  return { visible: true, state: "UPCOMING" };
}
