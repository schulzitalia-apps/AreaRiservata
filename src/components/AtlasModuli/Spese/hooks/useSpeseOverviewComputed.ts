"use client";

import { useEffect, useMemo } from "react";
import type { TimeKey } from "../types";
import type { VariantItem, CatKey } from "../speseOverview.category";
import type { DonutDatum } from "@/components/Charts/ui/ApexDonutChart";
import type { BarSeries } from "@/components/Charts/ui/ApexBarChart";

import {
  CATEGORY_META,
  PERIOD_LABEL,
  PCT_CURRENT_BY_TIME,
  PCT_PREV_BY_TIME,
  TOTALS,
  SLICE_DEFS,
  SUPPLIERS,
  TITLES,
  UPCOMING_BY_TIME,
  DONUT_COLORS,
} from "../mock";

import { euro, clamp, formatPct } from "../format";
import { buildDonut, buildMonthly, pickTopCategory } from "../calc";
import { buildTransactions, buildUpcoming } from "../generators";

import { colorForKey } from "../speseOverview.safe";

import {
  universeFromAnalytics,
  buildTotalsLikeFromApi,
  buildPctCurrentByTimeLikeFromApi,
  buildPctPrevByTimeLikeFromApi,
  buildCategoriesPrevFromApi,
  buildCategoriesCurrent,
  buildMonthlyFromApi,
  buildBarSeriesLike,
  buildTop5FromApi,
  buildUpcomingIpotizzatoFromApi,
} from "../speseOverview.api-adapters";

import {
  buildCategoryMetaLike,
  buildCategoryTabItems,
} from "../speseOverview.category";

/**
 * Questo hook contiene SOLO la parte “calcoli/derivazioni”
 * e non fa fetch. Si appoggia a:
 * - useMock
 * - apiData
 * - timeKey
 * - catKey
 * - query (q / deferredQ)
 */
export function useSpeseOverviewComputed(args: {
  useMock: boolean;
  apiData?: any;
  timeKey: TimeKey;
  catKey: CatKey;
  setCatKey: (v: CatKey) => void;
  q: string;
  deferredQ: string;
}) {
  const { useMock, apiData, timeKey, catKey, setCatKey, deferredQ } = args;

  const currentPeriodLabel = PERIOD_LABEL[timeKey];

  /**
   * Variants (API): source of truth = universeFromAnalytics
   */
  const variants: VariantItem[] = useMemo(() => {
    if (useMock || !apiData) return [];
    const keys = universeFromAnalytics(apiData);
    return keys.map((vid) => ({
      variantId: vid,
      label: (CATEGORY_META as any)?.[vid]?.label ?? vid,
    }));
  }, [useMock, apiData]);

  // se in API e catKey non esiste più -> fallback all
  useEffect(() => {
    if (useMock) return;
    const allowed = new Set<string>(["all", ...variants.map((v) => String(v.variantId))]);
    if (!allowed.has(String(catKey))) setCatKey("all");
  }, [useMock, variants, catKey, setCatKey]);

  /**
   * Category meta/tabs (mock vs api)
   */
  const categoryMetaLike = useMemo(() => {
    return buildCategoryMetaLike({
      baseMeta: CATEGORY_META as any,
      useMock,
      variants,
    });
  }, [useMock, variants]);

  const categoryTabItems = useMemo(() => {
    return buildCategoryTabItems({
      useMock,
      baseMeta: CATEGORY_META as any,
      variants,
      categoryMetaLike,
    });
  }, [useMock, variants, categoryMetaLike]);

  /**
   * Totals + % split
   */
  const totalsLike = useMemo(() => {
    if (useMock || !apiData) return TOTALS;

    return buildTotalsLikeFromApi({
      apiData,
      timeKey,
      TOTALS_MOCK: TOTALS,
    });
  }, [useMock, apiData, timeKey]);

  const currentLordo = totalsLike[timeKey].current.lordo;
  const currentIva = totalsLike[timeKey].current.ivaRecuperata;
  const prevLordo = totalsLike[timeKey].prev.lordo;

  const pctCurrentByTimeLike = useMemo(() => {
    if (useMock || !apiData) return PCT_CURRENT_BY_TIME;

    return buildPctCurrentByTimeLikeFromApi({
      apiData,
      timeKey,
      variants,
      PCT_CURRENT_BY_TIME_MOCK: PCT_CURRENT_BY_TIME,
    });
  }, [useMock, apiData, timeKey, variants]);

  const pctPrevByTimeLike = useMemo(() => {
    if (useMock || !apiData) return PCT_PREV_BY_TIME;

    return buildPctPrevByTimeLikeFromApi({
      apiData,
      timeKey,
      variants,
      PCT_PREV_BY_TIME_MOCK: PCT_PREV_BY_TIME,
    });
  }, [useMock, apiData, timeKey, variants]);

  /**
   * Donuts
   */
  const categoriesCurrent = useMemo(() => {
    return buildCategoriesCurrent({
      useMock,
      currentLordo,
      timeKey,
      pctCurrentByTimeLike,
      SLICE_DEFS,
      apiData,
      variants,
      categoryMetaLike,
    });
  }, [
    useMock,
    currentLordo,
    timeKey,
    pctCurrentByTimeLike,
    apiData,
    variants,
    categoryMetaLike,
  ]);

  const categoriesPrev = useMemo(() => {
    if (useMock || !apiData) {
      return buildDonut(prevLordo, pctPrevByTimeLike[timeKey], SLICE_DEFS);
    }

    return buildCategoriesPrevFromApi({
      prevLordo,
      timeKey,
      pctPrevByTimeLike,
      variants,
      categoryMetaLike,
      apiData,
    });
  }, [
    useMock,
    apiData,
    prevLordo,
    timeKey,
    pctPrevByTimeLike,
    variants,
    categoryMetaLike,
  ]);

  /**
   * KPI / insight
   */
  const deltaAbs = currentLordo - prevLordo;
  const deltaPct = (deltaAbs / Math.max(1, prevLordo)) * 100;
  const deltaIsUp = deltaAbs > 0;

  const topCurrent = useMemo(
    () => pickTopCategory(categoriesCurrent as DonutDatum[]),
    [categoriesCurrent],
  );

  const gaugePercent = clamp((currentLordo / Math.max(1, prevLordo)) * 100, 0, 200);
  const gaugeSubtitle = `${euro(currentLordo)} / ${euro(prevLordo)} (${Math.round(gaugePercent)}%)`;

  const insightLine = deltaIsUp
    ? `Spesa operativa in crescita: ${euro(deltaAbs)} (${formatPct(deltaPct, 0)}) sul periodo precedente.`
    : `Spesa operativa in contrazione: ${euro(Math.abs(deltaAbs))} (${formatPct(
      Math.abs(deltaPct),
      0,
    )}) sul periodo precedente.`;

  /**
   * Upcoming (mock vs api) — API: solo ipotizzato
   */
  const upcoming = useMemo(() => {
    if (useMock || !apiData) return buildUpcoming(timeKey, UPCOMING_BY_TIME);
    return buildUpcomingIpotizzatoFromApi({ useMock, apiData }) as any[];
  }, [useMock, apiData, timeKey]);

  const filteredUpcoming = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    if (!query) return upcoming;
    return upcoming.filter((r: any) =>
      `${r.title} ${r.dateLabel}`.toLowerCase().includes(query),
    );
  }, [upcoming, deferredQ]);

  const upcomingTotal = useMemo(
    () => filteredUpcoming.reduce((a: number, r: any) => a + (r.amount ?? 0), 0),
    [filteredUpcoming],
  );

  /**
   * Monthly dataset (mock vs api) — API: solo current window (già fixato in adapter)
   */
  const monthly = useMemo(() => {
    if (useMock || !apiData) {
      return buildMonthly(timeKey, currentLordo, pctCurrentByTimeLike[timeKey]);
    }
    return buildMonthlyFromApi({ apiData, variants, timeKey });
  }, [useMock, apiData, timeKey, currentLordo, pctCurrentByTimeLike, variants]);

  const barPack = useMemo(() => {
    return buildBarSeriesLike({
      catKey,
      monthly: monthly as any[],
      categoryMetaLike,
    });
  }, [catKey, monthly, categoryMetaLike]);

  const barSeries = barPack.series as BarSeries[];
  const barColors = barPack.colors as string[];

  /**
   * Top5 (API: no fallback mock, davvero “più alte”)
   */
  const top5FromApi = useMemo(() => {
    return buildTop5FromApi({
      useMock,
      apiData,
      catKey,
      bucket: ["paidOrInvoicedRecent", "programmatoTop"],
    });
  }, [useMock, apiData, catKey]);

  const top10 = useMemo(() => {
    if (!useMock && apiData) return (top5FromApi ?? []).slice(0, 5);

    if (top5FromApi && top5FromApi.length) return top5FromApi.slice(0, 5);

    const txns = buildTransactions(monthly as any, {
      suppliers: SUPPLIERS,
      titlesByCategory: TITLES,
    });

    const filtered =
      catKey === "all" ? txns : txns.filter((t: any) => String(t.category) === String(catKey));

    return filtered.sort((a: any, b: any) => b.amount - a.amount).slice(0, 5);
  }, [catKey, monthly, top5FromApi, useMock, apiData]);

  const catLabel = categoryMetaLike[String(catKey)]?.label ?? String(catKey);
  const catColor = categoryMetaLike[String(catKey)]?.color ?? colorForKey(String(catKey));

  const donutColors = useMock
    ? DONUT_COLORS
    : (variants.map(
      (v) => categoryMetaLike[v.variantId]?.color ?? colorForKey(v.variantId),
    ) as any);

  return {
    // labels
    currentPeriodLabel,
    insightLine,

    // variants/categories/tabs
    variants,
    categoryMetaLike,
    categoryTabItems,

    // totals/kpi
    currentLordo,
    currentIva,
    prevLordo,
    deltaAbs,
    deltaPct,
    deltaIsUp,
    topCurrent,
    gaugePercent,
    gaugeSubtitle,

    // donuts
    categoriesCurrent,
    categoriesPrev,
    donutColors,

    // upcoming
    upcoming,
    filteredUpcoming,
    upcomingTotal,

    // bar
    monthly,
    barSeries,
    barColors,

    // top
    top10,

    // misc
    catLabel,
    catColor,
  };
}
