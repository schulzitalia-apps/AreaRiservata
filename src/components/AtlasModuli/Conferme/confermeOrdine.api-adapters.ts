// src/components/AtlasModuli/ConfermeOrdine/confermeOrdine.api-adapters.ts

import type { DonutDatum } from "@/components/Charts/ui/ApexDonutChart";
import type { BarSeries } from "@/components/Charts/ui/ApexBarChart";
import type { TimeKey, CatKey, ConfermeOrdineAnalyticsResponse, StatusBreakdownRow } from "./types";
import type { CategoryMeta } from "./confermeOrdine.category";
import {
  isoMonthLabel,
  safeNum,
  safeStr,
  monthStartUTC,
  addMonthsUTC,
  endOfMonthUTC,
} from "./confermeOrdine.safe";

/**
 * Universe = keys reali presenti in months[].byVariantId
 * (qui: clienti)
 */
export function universeFromAnalytics(apiData?: ConfermeOrdineAnalyticsResponse): string[] {
  const months = Array.isArray((apiData as any)?.months) ? (apiData as any).months : [];
  const set = new Set<string>();

  for (const row of months) {
    const byKey = row?.byVariantId || {};
    for (const k of Object.keys(byKey)) {
      const kk = safeStr(k);
      if (kk) set.add(kk);
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Split PREV/CURRENT:
 * monthsBack API = window*2 (come ricavi)
 */
function splitPrevCurrentMonths(
  apiData: ConfermeOrdineAnalyticsResponse,
  timeKey: TimeKey,
): { prev: any[]; current: any[] } {
  const months = Array.isArray((apiData as any)?.months) ? (apiData as any).months : [];
  const sorted = [...months].sort((a: any, b: any) => String(a.month).localeCompare(String(b.month)));

  if (timeKey !== "anno_fiscale") {
    const half = Math.floor(sorted.length / 2);
    return { prev: sorted.slice(0, half), current: sorted.slice(half) };
  }

  const last = sorted[sorted.length - 1];
  const lastMonth = String(last?.month ?? "");
  const y = Number(lastMonth.slice(0, 4));

  if (!y) {
    const half = Math.floor(sorted.length / 2);
    return { prev: sorted.slice(0, half), current: sorted.slice(half) };
  }

  const currentStart = `${y}-01`;
  const prevStart = `${y - 1}-01`;
  const prevEnd = `${y - 1}-12`;

  const current = sorted.filter((r: any) => String(r.month) >= currentStart);
  const prev = sorted.filter((r: any) => {
    const m = String(r.month);
    return m >= prevStart && m <= prevEnd;
  });

  return { prev, current };
}

function sumTotalsFromMonths(months: any[]) {
  let valore = 0;

  for (const row of months) {
    const totals = row?.totals;
    if (totals) {
      valore += safeNum(totals.valore);
      continue;
    }

    const byKey = row?.byVariantId || {};
    for (const k of Object.keys(byKey)) {
      valore += safeNum(byKey[k]?.valore);
    }
  }

  return { valore: Math.round(valore) };
}

function sumByKeyFromMonths(months: any[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const row of months) {
    const byKey = row?.byVariantId || {};
    for (const k of Object.keys(byKey)) {
      const kk = safeStr(k);
      acc[kk] = (acc[kk] ?? 0) + safeNum(byKey[k]?.valore);
    }
  }
  return acc;
}

/**
 * Donut per CLIENTE:
 * - CURRENT window
 */
export function buildCategoriesCurrentFromApi(args: {
  apiData?: ConfermeOrdineAnalyticsResponse;
  timeKey: TimeKey;
  categoryMetaLike: CategoryMeta;
}) {
  if (!args.apiData) return [{ label: "Totale", value: 0 }] as DonutDatum[];

  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const universe = universeFromAnalytics(args.apiData);
  const sumByKey = sumByKeyFromMonths(current);

  const data: DonutDatum[] = universe.map((k) => ({
    label: args.categoryMetaLike?.[k]?.label ?? k,
    value: Math.round(safeNum(sumByKey[k])),
  }));

  if (!data.some((d) => safeNum(d.value) > 0)) return [{ label: "Totale", value: 0 }] as DonutDatum[];
  return data;
}

/**
 * Donut PREV window (sinistra)
 */
export function buildCategoriesPrevFromApi(args: {
  apiData?: ConfermeOrdineAnalyticsResponse;
  timeKey: TimeKey;
  categoryMetaLike: CategoryMeta;
}) {
  if (!args.apiData) return [{ label: "Totale", value: 0 }] as DonutDatum[];

  const { prev } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const universe = universeFromAnalytics(args.apiData);
  const sumByKey = sumByKeyFromMonths(prev);

  const data: DonutDatum[] = universe.map((k) => ({
    label: args.categoryMetaLike?.[k]?.label ?? k,
    value: Math.round(safeNum(sumByKey[k])),
  }));

  if (!data.some((d) => safeNum(d.value) > 0)) return [{ label: "Totale", value: 0 }] as DonutDatum[];
  return data;
}

/**
 * Monthly dataset:
 * ✅ SOLO finestra CURRENT
 * (label mese + totale + byCliente)
 */
export function buildMonthlyCurrentFromApi(args: {
  apiData: ConfermeOrdineAnalyticsResponse;
  timeKey: TimeKey;
}) {
  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const sorted = [...current].sort((a: any, b: any) => String(a.month).localeCompare(String(b.month)));
  const universe = universeFromAnalytics(args.apiData);

  return sorted.map((row: any) => {
    const byKey = row?.byVariantId || {};
    const byCategory: Record<string, number> = {};
    for (const k of universe) byCategory[k] = 0;

    let total = 0;
    for (const k of Object.keys(byKey)) {
      const kk = safeStr(k);
      const v = safeNum(byKey[k]?.valore);
      total += v;
      byCategory[kk] = (byCategory[kk] ?? 0) + v;
    }

    return {
      isoMonth: String(row.month),
      label: isoMonthLabel(String(row.month)),
      total: Math.round(total),
      byCategory,
    };
  });
}

/**
 * Bar series:
 * - all => totale
 * - cliente selezionato => cliente vs resto (stacked)
 */
export function buildBarSeriesLike(args: {
  catKey: CatKey;
  monthly: any[];
  categoryMetaLike: CategoryMeta;
}): { series: BarSeries[]; colors: string[]; stacked: boolean } {
  if (args.catKey === "all") {
    return {
      series: [
        { name: "Totale", data: args.monthly.map((m: any) => ({ x: m.label, y: safeNum(m.total) })) },
      ],
      colors: ["#5750F1"],
      stacked: false,
    };
  }

  const sel = String(args.catKey);
  return {
    series: [
      {
        name: args.categoryMetaLike?.[sel]?.label ?? sel,
        data: args.monthly.map((m: any) => ({ x: m.label, y: safeNum(m.byCategory?.[sel]) })),
      },
      {
        name: "Resto",
        data: args.monthly.map((m: any) => ({
          x: m.label,
          y: Math.max(0, safeNum(m.total) - safeNum(m.byCategory?.[sel])),
        })),
      },
    ],
    colors: [
      args.categoryMetaLike?.[sel]?.color ?? "#0ABEF9",
      "rgba(255,255,255,0.10)",
    ],
    stacked: true,
  };
}

/* ---------------------------
 * UPCOMING (periodo + 2 mesi)
 * -------------------------- */

function endOfCurrentWindowPlus2Months(args: {
  apiData: ConfermeOrdineAnalyticsResponse;
  timeKey: TimeKey;
}): number {
  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const last = [...current].sort((a: any, b: any) => String(a.month).localeCompare(String(b.month))).slice(-1)[0];
  const lastMonth = safeStr(last?.month);
  const start = monthStartUTC(lastMonth);
  if (!start) return Number.POSITIVE_INFINITY;

  const endMonth = endOfMonthUTC(start);
  const plus2Start = addMonthsUTC(monthStartUTC(lastMonth)!, 2);
  const endPlus2 = endOfMonthUTC(plus2Start);

  // “periodo visto” endMonth + 2 mesi avanti (fino a fine mese)
  return endPlus2.getTime();
}

function dateLabelFromIso(iso: string | null | undefined) {
  const s = safeStr(iso);
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffMs = d.getTime() - startOfToday;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Oggi";
  if (diffDays === 1) return "Domani";
  if (diffDays < 14) return `Tra ${diffDays} giorni`;
  if (diffDays < 60) return `Tra ${Math.round(diffDays / 7)} settimane`;
  return `Tra ${Math.round(diffDays / 30)} mesi`;
}

/**
 * Upcoming consegne:
 * - bucket: apiData.top.upcoming
 * - filtro: entro fine(currentWindow)+2 mesi
 * - ordina per data asc
 */
export function buildUpcomingFromApi(args: {
  apiData?: ConfermeOrdineAnalyticsResponse;
  timeKey: TimeKey;
}): Array<{ title: string; dateLabel: string; amount: number; iso: string }> {
  if (!args.apiData) return [];

  const bucket = (args.apiData as any).top?.upcoming || {};
  const maxTs = endOfCurrentWindowPlus2Months({ apiData: args.apiData, timeKey: args.timeKey });

  const out: Array<{ title: string; dateLabel: string; amount: number; iso: string }> = [];

  for (const k of Object.keys(bucket)) {
    const arr = Array.isArray(bucket?.[k]) ? bucket[k] : [];
    for (const x of arr) {
      // ✅ grafici = start date => upcoming usiamo inizioConsegna (se c’è), fallback fine
      const iso = safeStr(x?.inizioConsegna ?? x?.effectiveDate ?? x?.fineConsegna ?? "");
      if (!iso) continue;

      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getTime() > maxTs) continue;

      const title = safeStr(x?.riferimento) || safeStr(x?.numeroOrdine) || "Consegna";
      const amount = Math.round(safeNum(x?.valore ?? x?.valoreCommessa ?? 0));

      out.push({ title, amount, iso, dateLabel: dateLabelFromIso(iso) });
    }
  }

  return out.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime()).slice(0, 200);
}

/* ---------------------------
 * STATUS BREAKDOWN (no memo)
 * -------------------------- */

/**
 * Conta statoAvanzamento su un set di item (dedupe per id).
 * Nota: l’API non fornisce una distribuzione completa; qui usiamo top.recent + top.upcoming,
 * che nella pratica è sufficiente per “dashboard operativa”.
 * Se vuoi distribuzione completa, la facciamo lato backend con un facet dedicato.
 */
export function buildStatusBreakdownFromApi(args: {
  apiData?: ConfermeOrdineAnalyticsResponse;
}): StatusBreakdownRow[] {
  if (!args.apiData) return [];

  const seen = new Set<string>();
  const rows: any[] = [];

  const take = (bucket: any) => {
    for (const k of Object.keys(bucket || {})) {
      const arr = Array.isArray(bucket?.[k]) ? bucket[k] : [];
      for (const x of arr) {
        const id = safeStr(x?.id ?? x?._id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        rows.push(x);
      }
    }
  };

  take((args.apiData as any).top?.recent || {});
  take((args.apiData as any).top?.upcoming || {});

  const acc: Record<string, number> = {};
  for (const x of rows) {
    const s = safeStr(x?.statoAvanzamento || "da_definire") || "da_definire";
    acc[s] = (acc[s] ?? 0) + 1;
  }

  return Object.keys(acc)
    .map((k) => ({ stato: k, count: acc[k] }))
    .sort((a, b) => b.count - a.count);
}

/* ---------------------------
 * TOTALS / DELTA
 * -------------------------- */

export function buildTotalsLike(args: {
  apiData: ConfermeOrdineAnalyticsResponse;
  timeKey: TimeKey;
}) {
  const { prev, current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const currentTotals = sumTotalsFromMonths(current);
  const prevTotals = sumTotalsFromMonths(prev);

  return {
    current: currentTotals,
    prev: prevTotals,
  };
}