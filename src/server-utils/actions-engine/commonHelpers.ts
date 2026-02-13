import type { TimeKind } from "../models/evento.schema";

/**
 * Prova a convertire un valore in Date valida.
 * - Date → se valida la ritorna
 * - string/number → new Date(...)
 * - altro → null
 */
export function toValidDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Porta una data all'inizio del giorno (00:00).
 * Utile per creare eventi "a giornata" sulla data odierna.
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calcola startAt / endAt a partire da una data base (fieldDate)
 * e dal timeKind dell'evento.
 *
 * - "point":                startAt = base, endAt = null
 * - "deadline":             startAt = null, endAt = base
 * - "interval":             startAt = base, endAt = base + intervalDays
 * - "recurring_master/*":   trattati come "point"
 */
export function computeTimeRange(
  fieldDate: Date,
  timeKind: TimeKind,
  action: any,
): { startAt: Date | null; endAt: Date | null } {
  const base = fieldDate;
  const oneDayMs = 24 * 60 * 60 * 1000;

  switch (timeKind) {
    case "point":
    case "recurring_master":
    case "recurring_occurrence":
      return { startAt: base, endAt: null };

    case "deadline":
      return { startAt: null, endAt: base };

    case "interval": {
      const intervalDays = Number(action.intervalDays ?? 1);
      const end = new Date(
        base.getTime() + Math.max(intervalDays, 1) * oneDayMs,
      );
      return { startAt: base, endAt: end };
    }

    default:
      return { startAt: base, endAt: null };
  }
}

/**
 * Sostituisce {{path}} dentro a una stringa template
 * con i valori presi dal context.
 *
 * Esempio:
 *   template: "Ordine {{anagrafica.numeroOrdine}}"
 *   context:  { anagrafica: { numeroOrdine: "ABC123" } }
 *   → "Ordine ABC123"
 */
export function renderTemplate(
  template: string | undefined,
  context: Record<string, any>,
): string | undefined {
  if (!template) return undefined;

  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawPath) => {
    const path = String(rawPath).trim();
    const segments = path.split(".");
    let current: any = context;

    for (const seg of segments) {
      if (current == null) break;
      current = current[seg];
    }

    if (current === undefined || current === null) return "";
    return String(current);
  });
}
