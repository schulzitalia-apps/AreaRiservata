// src/components/AtlasModuli/Ricavi/ricaviOverview.safe.ts
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


export function isoMonthLabel(isoMonth: string) {
  const [y, m] = isoMonth.split("-").map((x) => Number(x));
  if (!y || !m) return isoMonth;
  return new Date(y, m - 1, 1).toLocaleDateString("it-IT", {
    month: "short",
    year: "2-digit",
  });
}

export function safeNum(x: any): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function safeStr(x: any): string {
  if (x === null || x === undefined) return "";
  return String(x);
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
