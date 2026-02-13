import type { IEventoDoc } from "../models/evento.schema";
import { decodeAutoEvent } from "./autoEventCodec";
import { resolveActionById } from "@/config/actions.registry";

type VisibilityMode = "SEMPRE" | "DOPO_DATA" | "FINO_A_DATA" | "FINESTRA";

/**
 * Decide se un evento (potenzialmente auto-generato) è visibile "ora".
 *
 * - Se _autoEvent è vuoto → non è un auto-evento → il motore non interviene (true).
 * - Se l'azione non ha visibility/config → fallback true (non nascondiamo).
 *
 * L'idea è che questo sia un filtro *soft*:
 * lo puoi usare lato server prima di restituire gli eventi,
 * oppure lato front quando costruisci la vista.
 */
export function isAutoEventoVisibleNow(
  evento: Pick<IEventoDoc, "startAt" | "endAt" | "_autoEvent">,
  now: Date = new Date(),
): boolean {
  const meta = decodeAutoEvent(evento._autoEvent);
  if (!meta) {
    // evento normale → il motore non decide su di lui
    return true;
  }

  const action = resolveActionById(meta.scope, meta.actionId) as
    | (Record<string, any> & { visibility?: VisibilityMode })
    | null;

  if (!action) {
    // regola non trovata → non rischiamo di nasconderlo
    return true;
  }

  const visibility = (action.visibility ?? "SEMPRE") as VisibilityMode;

  if (visibility === "SEMPRE") return true;

  // la data "base" su cui ragionare:
  // se è un deadline userai di solito endAt, altrimenti startAt.
  const baseDateRaw = evento.endAt ?? evento.startAt;
  if (!baseDateRaw) return true;

  const baseDate = new Date(baseDateRaw);
  if (Number.isNaN(baseDate.getTime())) return true;

  const nowMs = now.getTime();
  const baseMs = baseDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (visibility) {
    case "DOPO_DATA":
      return nowMs >= baseMs;

    case "FINO_A_DATA":
      return nowMs <= baseMs;

    case "FINESTRA": {
      const beforeDays = Number(action.windowDaysBefore ?? 0) || 0;
      const afterDays = Number(action.windowDaysAfter ?? 0) || 0;

      const startWindow = baseMs - beforeDays * dayMs;
      const endWindow = baseMs + afterDays * dayMs;

      return nowMs >= startWindow && nowMs <= endWindow;
    }

    default:
      return true;
  }
}
