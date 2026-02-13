import type { DonutDatum } from "@/components/Charts/ui/ApexDonutChart";
import type { BarSeries } from "@/components/Charts/ui/ApexBarChart";
import type { TimeKey } from "./types";
import type { RicaviAnalyticsResponse } from "@/components/Store/models/financials";
import type { CategoryMeta, VariantItem, CatKey } from "./ricaviOverview.category";
import { isoMonthLabel, safeNum, safeStr, colorForKey } from "./ricaviOverview.safe";
import { buildDonut } from "./calc";

/**
 * Fonte di verità categorie: keys reali presenti in apiData.months[].byVariantId
 */
export function universeFromAnalytics(apiData?: RicaviAnalyticsResponse): string[] {
  const months = Array.isArray((apiData as any)?.months) ? (apiData as any).months : [];
  const set = new Set<string>();

  for (const row of months) {
    const byVid = row?.byVariantId || {};
    for (const k of Object.keys(byVid)) {
      const vid = safeStr(k);
      if (vid) set.add(vid);
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Split mesi in PREV + CURRENT.
 * NB: monthsBack = base*2.
 */
function splitPrevCurrentMonths(
  apiData: RicaviAnalyticsResponse,
  timeKey: TimeKey,
): { prev: any[]; current: any[] } {
  const months = Array.isArray((apiData as any)?.months) ? (apiData as any).months : [];
  const sorted = [...months].sort((a: any, b: any) =>
    String(a.month).localeCompare(String(b.month)),
  );

  // default: metà/metà
  if (timeKey !== "anno_fiscale") {
    const half = Math.floor(sorted.length / 2);
    return { prev: sorted.slice(0, half), current: sorted.slice(half) };
  }

  // ✅ anno_fiscale:
  // current = da gennaio dell'anno dell'ultimo mese presente nei dati
  // prev    = tutto l'anno precedente (gen-dic)
  const last = sorted[sorted.length - 1];
  const lastMonth = String(last?.month ?? ""); // "YYYY-MM"
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
  const sum = { lordo: 0, netto: 0, iva: 0 };

  for (const row of months) {
    const totals = row?.totals;
    if (totals) {
      sum.lordo += safeNum(totals.lordo);
      sum.netto += safeNum(totals.netto);
      sum.iva += safeNum(totals.iva);
      continue;
    }

    const byVid = row?.byVariantId || {};
    for (const vid of Object.keys(byVid)) {
      const v = byVid[vid];
      sum.lordo += safeNum(v?.lordo);
      sum.netto += safeNum(v?.netto);
      sum.iva += safeNum(v?.iva);
    }
  }

  return {
    lordo: Math.round(sum.lordo),
    netto: Math.round(sum.netto),
    ivaRecuperata: Math.round(sum.iva),
  };
}

function sumByVariantFromMonths(months: any[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const row of months) {
    const byVid = row?.byVariantId || {};
    for (const vid of Object.keys(byVid)) {
      const k = safeStr(vid);
      acc[k] = (acc[k] ?? 0) + safeNum(byVid[vid]?.lordo);
    }
  }
  return acc;
}

/**
 * TOTALS-like: current + prev veri (NO fallback mock)
 */
export function buildTotalsLikeFromApi(args: {
  apiData: RicaviAnalyticsResponse;
  timeKey: TimeKey;
  TOTALS_MOCK: any;
}) {
  const { prev, current } = splitPrevCurrentMonths(args.apiData, args.timeKey);

  const currentTotals = sumTotalsFromMonths(current);
  const prevTotals = sumTotalsFromMonths(prev);

  return {
    ...args.TOTALS_MOCK,
    [args.timeKey]: {
      current: currentTotals,
      prev: { lordo: prevTotals.lordo },
    },
  };
}

/**
 * Percentuali CURRENT per variantId (calcolate su current window)
 */
export function buildPctCurrentByTimeLikeFromApi(args: {
  apiData: RicaviAnalyticsResponse;
  timeKey: TimeKey;
  variants: VariantItem[];
  PCT_CURRENT_BY_TIME_MOCK: any;
}) {
  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const universe = universeFromAnalytics(args.apiData);

  const acc = sumByVariantFromMonths(current);
  const total = Object.values(acc).reduce((a, n) => a + safeNum(n), 0);

  const outPct: Record<string, number> = {};
  for (const vid of universe) {
    const pct = total > 0 ? (safeNum(acc[vid]) / total) * 100 : 0;
    outPct[vid] = Math.round(pct * 100) / 100;
  }

  return {
    ...args.PCT_CURRENT_BY_TIME_MOCK,
    [args.timeKey]: outPct,
  };
}

/**
 * Percentuali PREV per variantId (calcolate su prev window)
 */
export function buildPctPrevByTimeLikeFromApi(args: {
  apiData: RicaviAnalyticsResponse;
  timeKey: TimeKey;
  variants: VariantItem[];
  PCT_PREV_BY_TIME_MOCK: any;
}) {
  const { prev } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const universe: string[] = universeFromAnalytics(args.apiData);

  const acc: Record<string, number> = sumByVariantFromMonths(prev);
  const total: number = Object.values(acc).reduce((a: number, n) => a + safeNum(n), 0);

  const outPct: Record<string, number> = {};
  for (const vid of universe) {
    const pct = total > 0 ? (safeNum(acc[vid]) / total) * 100 : 0;
    outPct[vid] = Math.round(pct * 100) / 100;
  }

  return {
    ...args.PCT_PREV_BY_TIME_MOCK,
    [args.timeKey]: outPct,
  };
}


/**
 * Donut CURRENT
 */
export function buildCategoriesCurrent(args: {
  useMock: boolean;
  currentLordo: number;
  timeKey: TimeKey;

  // mock path
  pctCurrentByTimeLike: any;
  SLICE_DEFS: any;

  // api path
  apiData?: RicaviAnalyticsResponse;
  variants: VariantItem[];
  categoryMetaLike: CategoryMeta;
}) {
  if (args.useMock) {
    return buildDonut(
      args.currentLordo,
      args.pctCurrentByTimeLike?.[args.timeKey] || {},
      args.SLICE_DEFS,
    );
  }

  if (!args.apiData) return [{ key: "all", label: "Totale", value: 0 }] as any;

  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const universe = universeFromAnalytics(args.apiData);

  const sumByVid = sumByVariantFromMonths(current);

  const data: DonutDatum[] = universe.map((vid) => {
    const label =
      args.categoryMetaLike?.[vid]?.label ??
      args.variants?.find((v) => safeStr(v.variantId) === vid)?.label ??
      vid;

    return { label, value: Math.round(safeNum(sumByVid[vid])) };
  });

  if (!data.some((d) => safeNum(d.value) > 0)) {
    return [{ key: "all", label: "Totale", value: 0 }] as any;
  }

  return data as any;
}

/**
 * Donut PREV (NO MOCK fallback)
 */
export function buildCategoriesPrevFromApi(args: {
  prevLordo: number;
  timeKey: TimeKey;
  pctPrevByTimeLike: any;
  variants: VariantItem[];
  categoryMetaLike: CategoryMeta;
  apiData?: RicaviAnalyticsResponse;
}) {
  if (!args.apiData) return [{ key: "all", label: "Totale", value: 0 }] as any;

  const { prev } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const universe = universeFromAnalytics(args.apiData);

  const sumByVid = sumByVariantFromMonths(prev);

  const data: DonutDatum[] = universe.map((vid) => {
    const label =
      args.categoryMetaLike?.[vid]?.label ??
      args.variants?.find((v) => safeStr(v.variantId) === vid)?.label ??
      vid;

    return { label, value: Math.round(safeNum(sumByVid[vid])) };
  });

  if (!data.some((d) => safeNum(d.value) > 0)) {
    return [{ key: "all", label: "Totale", value: 0 }] as any;
  }

  return data as any;
}

/**
 * Monthly dataset:
 * ✅ SOLO finestra CURRENT
 */
export function buildMonthlyFromApi(args: {
  apiData: RicaviAnalyticsResponse;
  variants: VariantItem[];
  timeKey: TimeKey; // ✅ aggiungi
}) {
  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const sorted = [...current].sort((a: any, b: any) =>
    String(a.month).localeCompare(String(b.month)),
  );

  const universe = universeFromAnalytics(args.apiData);

  return sorted.map((row: any) => {
    const byVid = row?.byVariantId || {};
    const byCategory: Record<string, number> = {};
    for (const vid of universe) byCategory[vid] = 0;

    let total = 0;
    for (const vid of Object.keys(byVid)) {
      const k = safeStr(vid);
      const lordo = safeNum(byVid[vid]?.lordo);
      total += lordo;
      byCategory[k] = (byCategory[k] ?? 0) + lordo;
    }

    return {
      label: isoMonthLabel(String(row.month)),
      total: Math.round(total),
      byCategory,
    };
  });
}


export function buildBarSeriesLike(args: {
  catKey: CatKey;
  monthly: any[];
  categoryMetaLike: CategoryMeta;
}): { series: BarSeries[]; colors: string[]; stacked: boolean } {
  if (args.catKey === "all") {
    return {
      series: [
        {
          name: "Totale",
          data: args.monthly.map((m: any) => ({ x: m.label, y: safeNum(m.total) })),
        },
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
      args.categoryMetaLike?.[sel]?.color ?? colorForKey(sel),
      "rgba(255,255,255,0.10)",
    ],
    stacked: true,
  };
}

/* ---------------------------
 * TOP / UPCOMING
 * -------------------------- */

function normalizeTopRevenueItem(vid: string, x: any) {
  const titolo =
    safeStr(x?.titolo) ||
    safeStr(x?.descrizione) ||
    safeStr(x?.title) ||
    "Ricavo";

  const cliente =
    safeStr(x?.cliente) ||
    safeStr(x?.clienteVendita) ||
    safeStr(x?.ragioneSocialeRicavo) ||
    "";

  const amount = Math.round(
    safeNum(x?.totaleLordo ?? x?.lordo ?? x?.amount ?? 0),
  );

  const effectiveDate = safeStr(
    x?.effectiveDate ?? x?.dataPagamento ?? x?.dataFatturazione ?? "",
  );

  return {
    id: safeStr(x?.id ?? x?._id ?? `${vid}-${Math.random().toString(16).slice(2)}`),
    title: titolo,
    supplier: cliente ? cliente : null, // UI TopTenList usa "supplier" come seconda riga
    amount,
    category: vid,
    date: effectiveDate,
    statoFatturazione: safeStr(x?.statoFatturazione ?? ""),
    netto: Math.round(safeNum(x?.totaleNetto ?? x?.netto ?? 0)),
    iva: Math.round(safeNum(x?.importoIva ?? x?.iva ?? 0)),
    numeroFattura: safeStr(x?.numeroFattura ?? ""),
  };
}

/**
 * TOP5 Ricavi:
 * - merge + sort desc
 * - catKey=all supportato
 * - fallback bucket multipli
 */
export function buildTop5FromApi(args: {
  useMock: boolean;
  apiData?: RicaviAnalyticsResponse;
  catKey: CatKey;
  bucket: keyof RicaviAnalyticsResponse["top"] | Array<keyof RicaviAnalyticsResponse["top"]>;
}) {
  if (args.useMock || !args.apiData) return null;

  const buckets = Array.isArray(args.bucket) ? args.bucket : [args.bucket];

  let top: any = null;
  for (const b of buckets) {
    const cand = (args.apiData as any).top?.[b] || null;
    if (cand && typeof cand === "object" && Object.keys(cand).length) {
      top = cand;
      break;
    }
  }
  if (!top) return [];

  if (args.catKey === "all") {
    const merged: any[] = [];
    for (const vid of Object.keys(top)) {
      const arr = Array.isArray(top?.[vid]) ? top[vid] : [];
      for (const x of arr) merged.push(normalizeTopRevenueItem(String(vid), x));
    }
    return merged.sort((a, b) => safeNum(b.amount) - safeNum(a.amount)).slice(0, 5);
  }

  const vid = String(args.catKey);
  const items = Array.isArray(top?.[vid]) ? top[vid] : [];
  return items
    .map((x: any) => normalizeTopRevenueItem(vid, x))
    .sort((a, b) => safeNum(b.amount) - safeNum(a.amount))
    .slice(0, 5);
}

/**
 * UPCOMING Ricavi (API):
 * - solo "ipotizzato" da top.ipotizzatoUpcoming
 * - output compatibile con UpcomingTable
 */
export function buildUpcomingIpotizzatoFromApi(args: {
  useMock: boolean;
  apiData?: RicaviAnalyticsResponse;
}) {
  if (args.useMock || !args.apiData) return [];

  const bucket = (args.apiData as any).top?.ipotizzatoUpcoming || {};
  const out: Array<{ title: string; dateLabel: string; amount: number }> = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const dateLabelFromIso = (iso: string | null | undefined) => {
    const s = safeStr(iso);
    if (!s) return "—";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "—";

    const day = d.getDate();
    const isSameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

    const diffMs = d.getTime() - startOfToday;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (isSameMonth) return `${day} del mese`;
    if (diffDays <= 0) return "Oggi";
    if (diffDays === 1) return "Domani";
    if (diffDays < 14) return `Tra ${diffDays} giorni`;
    if (diffDays < 60) return `Tra ${Math.round(diffDays / 7)} settimane`;
    return `Tra ${Math.round(diffDays / 30)} mesi`;
  };

  for (const vid of Object.keys(bucket)) {
    const arr = Array.isArray(bucket?.[vid]) ? bucket[vid] : [];
    for (const x of arr) {
      const stato = safeStr(x?.statoFatturazione ?? "");
      if (stato.toLowerCase() !== "ipotizzato") continue;

      const title =
        safeStr(x?.descrizione) ||
        safeStr(x?.titolo) ||
        safeStr(x?.ragioneSocialeRicavo) ||
        safeStr(x?.clienteVendita) ||
        "Ricavo";

      const amount = Math.round(safeNum(x?.totaleLordo ?? x?.lordo ?? x?.amount ?? 0));
      const effectiveDate = safeStr(x?.effectiveDate ?? x?.dataPagamento ?? x?.dataFatturazione ?? "");

      out.push({
        title,
        amount,
        dateLabel: dateLabelFromIso(effectiveDate),
      });
    }
  }

  return out.slice(0, 200);
}
