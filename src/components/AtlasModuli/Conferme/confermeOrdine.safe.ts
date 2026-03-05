// src/components/AtlasModuli/ConfermeOrdine/confermeOrdine.safe.ts
import type { TimeKey } from "./types";

export function monthsBackFromTimeKey(t: TimeKey): number {
  switch (t) {
    case "mese":
      return 1;
    case "trimestre":
      return 3;
    case "semestre":
      return 6;
    case "anno":
      return 12;
    case "anno_fiscale":
      return 12;
    default:
      return 12;
  }
}

export function safeNum(x: any): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function safeStr(x: any): string {
  if (x === null || x === undefined) return "";
  return String(x);
}

export function isoMonthLabel(isoMonth: string) {
  const [y, m] = isoMonth.split("-").map((x) => Number(x));
  if (!y || !m) return isoMonth;
  return new Date(y, m - 1, 1).toLocaleDateString("it-IT", {
    month: "short",
    year: "2-digit",
  });
}

export const FALLBACK_COLORS = [
  "#5750F1",
  "#0ABEF9",
  "#22C55E",
  "#FB923C",
  "#EF4444",
  "#A855F7",
  "#14B8A6",
  "#F59E0B",
  "#60A5FA",
  "#F472B6",
];

export function colorForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

/** YYYY-MM -> Date UTC (inizio mese) */
export function monthStartUTC(isoMonth: string): Date | null {
  const [y, m] = isoMonth.split("-").map((x) => Number(x));
  if (!y || !m) return null;
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

export function addMonthsUTC(d: Date, delta: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1, 0, 0, 0, 0));
}

export function endOfMonthUTC(d: Date): Date {
  // ultimo ms del mese: start month+1 - 1ms
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return new Date(next.getTime() - 1);
}