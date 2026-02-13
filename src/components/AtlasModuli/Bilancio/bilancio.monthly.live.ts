import type { BilancioTimeKey } from "./types";
import { buildFiscalYearSeriesFromMonthly } from "./bilancio.fiscal";

type AnyMonthly = any[];

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toPoints(monthly: AnyMonthly): { label: string; value: number }[] {
  if (!Array.isArray(monthly)) return [];
  return monthly
    .map((it: any) => ({
      label: String(it?.x ?? it?.label ?? it?.monthLabel ?? it?.month ?? it?.name ?? it?.period ?? ""),
      value: Math.round(Number(it?.y ?? it?.value ?? it?.amount ?? it?.total ?? it?.lordo ?? 0) || 0),
    }))
    .filter((r) => r.label);
}

/**
 * ✅ Regola:
 * - mese: 1
 * - trimestre: 3
 * - semestre: 6
 * - anno: 12 (rolling)
 * - tutto: N mesi (tuttoMonths)
 * - anno_fiscale: Gen..oggi (YTD) (NON rolling!)
 */
function monthsWindow(timeKey: BilancioTimeKey, tuttoMonths: number) {
  switch (timeKey) {
    case "mese":
      return 1;
    case "trimestre":
      return 3;
    case "semestre":
      return 6;
    case "anno":
      return 12;
    case "tutto":
      return clampInt(tuttoMonths, 6, 60);
    case "anno_fiscale":
      // gestito a parte
      return 12;
    default:
      return 12;
  }
}

function sliceLast(points: { label: string; value: number }[], n: number) {
  if (!points.length) return [];
  return points.slice(Math.max(0, points.length - n));
}

export function buildMonthlyBarFromModules(args: {
  timeKey: BilancioTimeKey;
  ricaviMonthly: AnyMonthly;
  speseMonthly: AnyMonthly;
  colors: [string, string];
  tuttoMonths: number;
  now?: Date;
}) {
  const { timeKey, colors, now } = args;

  // ✅ CASO SPECIALE: ANNO FISCALE = YTD
  if (timeKey === "anno_fiscale") {
    const fy = buildFiscalYearSeriesFromMonthly({
      ricaviMonthly: args.ricaviMonthly,
      speseMonthly: args.speseMonthly,
      now,
    });

    return {
      categories: fy.categories,
      series: [
        { name: "Ricavi", data: fy.ricavi },
        { name: "Spese", data: fy.spese },
      ],
      colors: [...colors],
    };
  }

  // altri filtri = rolling window sugli ultimi N punti
  const n = monthsWindow(timeKey, args.tuttoMonths);

  const rPts = sliceLast(toPoints(args.ricaviMonthly), n);
  const sPts = sliceLast(toPoints(args.speseMonthly), n);

  // categorie: assumo stessa granularità e stessa sequenza (se no fallback)
  const categories = rPts.length ? rPts.map((p) => p.label) : sPts.map((p) => p.label);

  // allineo per indice (come i moduli)
  const r = rPts.map((p) => p.value);
  const s = sPts.map((p) => p.value);

  // padding se uno è più corto
  const L = Math.max(r.length, s.length, categories.length);
  while (r.length < L) r.unshift(0);
  while (s.length < L) s.unshift(0);
  while (categories.length < L) categories.unshift("");

  return {
    categories,
    series: [
      { name: "Ricavi", data: r },
      { name: "Spese", data: s },
    ],
    colors: [...colors],
  };
}
