import type { TimeKey } from "./types";
import type { RicaviAnalyticsResponse } from "@/components/Store/models/financials";
import type { CategoryMeta, VariantItem, CatKey } from "./ricaviOverview.category";
import type { DonutDatum } from "@/components/Charts/ui/ApexDonutChart";
import type { BarSeries } from "@/components/Charts/ui/ApexBarChart";
import { isoMonthLabel, safeNum, safeStr, colorForKey } from "./ricaviOverview.safe";
import { buildEmptyTotalsLike } from "./config";

export function universeFromAnalytics(apiData?: RicaviAnalyticsResponse): string[] {
  const months = Array.isArray(apiData?.months) ? apiData.months : [];
  const ids = new Set<string>();

  for (const row of months) {
    const byVariantId = row?.byVariantId ?? {};
    for (const key of Object.keys(byVariantId)) {
      const variantId = safeStr(key);
      if (variantId) ids.add(variantId);
    }
  }

  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

function splitPrevCurrentMonths(apiData: RicaviAnalyticsResponse, timeKey: TimeKey): { prev: any[]; current: any[] } {
  const months = Array.isArray(apiData?.months) ? apiData.months : [];
  const sorted = [...months].sort((a: any, b: any) => String(a?.month ?? "").localeCompare(String(b?.month ?? "")));

  if (!sorted.length) return { prev: [], current: [] };

  if (timeKey !== "anno_fiscale") {
    const half = Math.floor(sorted.length / 2);
    return { prev: sorted.slice(0, half), current: sorted.slice(half) };
  }

  const lastMonth = String(sorted[sorted.length - 1]?.month ?? "");
  const year = Number(lastMonth.slice(0, 4));
  if (!year) {
    const half = Math.floor(sorted.length / 2);
    return { prev: sorted.slice(0, half), current: sorted.slice(half) };
  }

  const currentStart = `${year}-01`;
  const prevStart = `${year - 1}-01`;
  const prevEnd = `${year - 1}-12`;

  return {
    prev: sorted.filter((row: any) => {
      const month = String(row?.month ?? "");
      return month >= prevStart && month <= prevEnd;
    }),
    current: sorted.filter((row: any) => String(row?.month ?? "") >= currentStart),
  };
}

function sumTotalsFromMonths(months: any[]) {
  const totals = { lordo: 0, netto: 0, iva: 0 };

  for (const row of months) {
    if (row?.totals) {
      totals.lordo += safeNum(row.totals.lordo);
      totals.netto += safeNum(row.totals.netto);
      totals.iva += safeNum(row.totals.iva);
      continue;
    }

    const byVariantId = row?.byVariantId ?? {};
    for (const variantId of Object.keys(byVariantId)) {
      const bucket = byVariantId[variantId];
      totals.lordo += safeNum(bucket?.lordo);
      totals.netto += safeNum(bucket?.netto);
      totals.iva += safeNum(bucket?.iva);
    }
  }

  return {
    lordo: Math.round(totals.lordo),
    netto: Math.round(totals.netto),
    ivaRecuperata: Math.round(totals.iva),
  };
}

function sumByVariantFromMonths(months: any[]): Record<string, number> {
  const out: Record<string, number> = {};

  for (const row of months) {
    const byVariantId = row?.byVariantId ?? {};
    for (const variantId of Object.keys(byVariantId)) {
      const key = safeStr(variantId);
      out[key] = (out[key] ?? 0) + safeNum(byVariantId[variantId]?.lordo);
    }
  }

  return out;
}

function labelForVariant(variantId: string, variants: VariantItem[], categoryMetaLike: CategoryMeta) {
  return categoryMetaLike?.[variantId]?.label ?? variants.find((variant) => safeStr(variant.variantId) === variantId)?.label ?? variantId;
}

export function buildTotalsLikeFromApi(args: { apiData: RicaviAnalyticsResponse; timeKey: TimeKey }) {
  const { prev, current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const totalsLike = buildEmptyTotalsLike();

  totalsLike[args.timeKey] = {
    current: sumTotalsFromMonths(current),
    prev: { lordo: sumTotalsFromMonths(prev).lordo, ivaRecuperata: 0 },
  };

  return totalsLike;
}

export function buildCategoriesCurrent(args: {
  apiData?: RicaviAnalyticsResponse;
  timeKey: TimeKey;
  variants: VariantItem[];
  categoryMetaLike: CategoryMeta;
}) {
  if (!args.apiData) return [{ key: "all", label: "Totale", value: 0 }] as any;

  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const universe = universeFromAnalytics(args.apiData);
  const sumByVariant = sumByVariantFromMonths(current);

  const data: DonutDatum[] = universe.map((variantId) => ({
    label: labelForVariant(variantId, args.variants, args.categoryMetaLike),
    value: Math.round(safeNum(sumByVariant[variantId])),
  }));

  return data.some((entry) => safeNum(entry.value) > 0) ? (data as any) : ([{ key: "all", label: "Totale", value: 0 }] as any);
}

export function buildCategoriesPrevFromApi(args: {
  apiData?: RicaviAnalyticsResponse;
  timeKey: TimeKey;
  variants: VariantItem[];
  categoryMetaLike: CategoryMeta;
}) {
  if (!args.apiData) return [{ key: "all", label: "Totale", value: 0 }] as any;

  const { prev } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const universe = universeFromAnalytics(args.apiData);
  const sumByVariant = sumByVariantFromMonths(prev);

  const data: DonutDatum[] = universe.map((variantId) => ({
    label: labelForVariant(variantId, args.variants, args.categoryMetaLike),
    value: Math.round(safeNum(sumByVariant[variantId])),
  }));

  return data.some((entry) => safeNum(entry.value) > 0) ? (data as any) : ([{ key: "all", label: "Totale", value: 0 }] as any);
}

export function buildMonthlyFromApi(args: { apiData: RicaviAnalyticsResponse; timeKey: TimeKey }) {
  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const sorted = [...current].sort((a: any, b: any) => String(a?.month ?? "").localeCompare(String(b?.month ?? "")));
  const universe = universeFromAnalytics(args.apiData);

  return sorted.map((row: any) => {
    const byVariantId = row?.byVariantId ?? {};
    const byCategory: Record<string, number> = {};
    let total = 0;

    for (const variantId of universe) byCategory[variantId] = 0;

    for (const variantId of Object.keys(byVariantId)) {
      const key = safeStr(variantId);
      const lordo = safeNum(byVariantId[variantId]?.lordo);
      total += lordo;
      byCategory[key] = (byCategory[key] ?? 0) + lordo;
    }

    return {
      label: isoMonthLabel(String(row?.month ?? "")),
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
          data: args.monthly.map((month: any) => ({ x: month.label, y: safeNum(month.total) })),
        },
      ],
      colors: ["#5750F1"],
      stacked: false,
    };
  }

  const selected = String(args.catKey);
  return {
    series: [
      {
        name: args.categoryMetaLike?.[selected]?.label ?? selected,
        data: args.monthly.map((month: any) => ({ x: month.label, y: safeNum(month.byCategory?.[selected]) })),
      },
      {
        name: "Resto",
        data: args.monthly.map((month: any) => ({
          x: month.label,
          y: Math.max(0, safeNum(month.total) - safeNum(month.byCategory?.[selected])),
        })),
      },
    ],
    colors: [args.categoryMetaLike?.[selected]?.color ?? colorForKey(selected), "rgba(255,255,255,0.24)"],
    stacked: true,
  };
}

function formatDateLabel(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function isoToMonthKey(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeTopRevenueItem(variantId: string, item: any) {
  const effectiveDate = safeStr(item?.effectiveDate ?? item?.dataPagamento ?? item?.dataFatturazione ?? "");
  const cliente = safeStr(item?.cliente ?? (item as any)?.clienteVendita ?? item?.ragioneSocialeRicavo ?? "");

  return {
    id: safeStr(item?.id ?? item?._id ?? `${variantId}-${Math.random().toString(16).slice(2)}`),
    title: safeStr(item?.titolo ?? (item as any)?.descrizione ?? (item as any)?.title ?? "Ricavo"),
    supplier: cliente || null,
    amount: Math.round(safeNum((item as any)?.totaleLordo ?? item?.lordo ?? (item as any)?.amount ?? 0)),
    category: variantId,
    date: effectiveDate,
    dateLabel: effectiveDate ? formatDateLabel(effectiveDate) : "-",
    statoFatturazione: safeStr(item?.statoFatturazione ?? ""),
    netto: Math.round(safeNum(item?.totaleNetto ?? item?.netto ?? 0)),
    iva: Math.round(safeNum(item?.importoIva ?? item?.iva ?? 0)),
    numeroFattura: safeStr(item?.numeroFattura ?? ""),
  };
}

export function buildTop5FromApi(args: {
  apiData?: RicaviAnalyticsResponse;
  catKey: CatKey;
  timeKey: TimeKey;
  bucket: keyof RicaviAnalyticsResponse["top"] | Array<keyof RicaviAnalyticsResponse["top"]>;
}) {
  if (!args.apiData) return [];

  const buckets = Array.isArray(args.bucket) ? args.bucket : [args.bucket];
  const { current } = splitPrevCurrentMonths(args.apiData, args.timeKey);
  const currentMonths = new Set(current.map((row: any) => safeStr(row?.month)));

  const matchesCurrentPeriod = (item: any) => {
    const effectiveDate = safeStr(item?.effectiveDate ?? item?.dataPagamento ?? item?.dataFatturazione ?? "");
    if (!effectiveDate) return true;
    return currentMonths.has(isoToMonthKey(effectiveDate));
  };

  let topBucket: Record<string, any[]> | null = null;
  for (const bucketName of buckets) {
    const candidate = args.apiData.top?.[bucketName] as Record<string, any[]> | undefined;
    if (candidate && Object.keys(candidate).length) {
      topBucket = candidate;
      break;
    }
  }
  if (!topBucket) return [];

  if (args.catKey === "all") {
    const merged: any[] = [];
    for (const variantId of Object.keys(topBucket)) {
      const items = Array.isArray(topBucket[variantId]) ? topBucket[variantId] : [];
      for (const item of items) {
        if (matchesCurrentPeriod(item)) merged.push(normalizeTopRevenueItem(variantId, item));
      }
    }

    return merged.sort((a, b) => safeNum(b.amount) - safeNum(a.amount)).slice(0, 5);
  }

  const variantId = String(args.catKey);
  const items = Array.isArray(topBucket[variantId]) ? topBucket[variantId] : [];
  return items
    .filter((item) => matchesCurrentPeriod(item))
    .map((item) => normalizeTopRevenueItem(variantId, item))
    .sort((a, b) => safeNum(b.amount) - safeNum(a.amount))
    .slice(0, 5);
}

export function buildUpcomingIpotizzatoFromApi(args: { apiData?: RicaviAnalyticsResponse }) {
  if (!args.apiData) return [];

  const bucket = args.apiData.top?.ipotizzatoUpcoming ?? {};
  const out: Array<{ title: string; dateLabel: string; amount: number }> = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const relativeDateLabel = (iso?: string | null) => {
    const value = safeStr(iso);
    if (!value) return "-";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";

    const diffDays = Math.round((parsed.getTime() - startOfToday) / (1000 * 60 * 60 * 24));
    const sameMonth = parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();

    if (sameMonth) return `${parsed.getDate()} del mese`;
    if (diffDays <= 0) return "Oggi";
    if (diffDays === 1) return "Domani";
    if (diffDays < 14) return `Tra ${diffDays} giorni`;
    if (diffDays < 60) return `Tra ${Math.round(diffDays / 7)} settimane`;
    return `Tra ${Math.round(diffDays / 30)} mesi`;
  };

  for (const variantId of Object.keys(bucket)) {
    const items = Array.isArray(bucket[variantId]) ? bucket[variantId] : [];
    for (const item of items) {
      const stato = safeStr(item?.statoFatturazione ?? "");
      if (stato.toLowerCase() !== "ipotizzato") continue;

      out.push({
        title: safeStr((item as any)?.descrizione ?? item?.titolo ?? item?.ragioneSocialeRicavo ?? (item as any)?.clienteVendita ?? "Ricavo"),
        amount: Math.round(safeNum((item as any)?.totaleLordo ?? item?.lordo ?? (item as any)?.amount ?? 0)),
        dateLabel: relativeDateLabel(item?.effectiveDate ?? item?.dataPagamento ?? item?.dataFatturazione ?? ""),
      });
    }
  }

  return out.slice(0, 200);
}
