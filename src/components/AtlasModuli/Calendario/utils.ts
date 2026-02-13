// src/components/AtlasModuli/Calendario/utils.ts

/**
 * Calcola l'intervallo (in ISO UTC) che copre l'intero mese "YYYY-MM".
 */
export function monthBounds(yyyyMm: string): {
  timeFrom: string;
  timeTo: string;
} {
  const [y, m] = yyyyMm.split("-").map(Number);

  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59)); // ultimo giorno

  const pad = (n: number) => String(n).padStart(2, "0");
  const toIso = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
      d.getUTCDate(),
    )}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
      d.getUTCSeconds(),
    )}Z`;

  return {
    timeFrom: toIso(start),
    timeTo: toIso(end),
  };
}

/**
 * Unisce "YYYY-MM-DD" + "HH:MM" in una stringa tipo ISO locale.
 * (Se vuoi usare UTC, puoi adattare qui.)
 */
export function buildLocalDateTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}
