"use client";

import { useEffect, useMemo } from "react";
import type { DonutDatum } from "@/components/Charts/ui/ApexDonutChart";
import type { BarSeries } from "@/components/Charts/ui/ApexBarChart";

import type { TimeKey, CatKey } from "../types";
import { euro, formatPct } from "../format";
import { colorForKey } from "../confermeOrdine.safe";

import {
  universeFromAnalytics,
  buildTotalsLike,
  buildCategoriesCurrentFromApi,
  buildCategoriesPrevFromApi,
  buildMonthlyCurrentFromApi,
  buildBarSeriesLike,
  buildUpcomingFromApi,
  buildStatusBreakdownFromApi,
} from "../confermeOrdine.api-adapters";

import {
  buildCategoryMetaLikeFromApi,
  buildCategoryTabItems,
} from "../confermeOrdine.category";

function pickTopCategory(data: DonutDatum[]) {
  return [...data].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0] ?? data[0];
}

export function useConfermeOrdineOverviewComputed(args: {
  apiData?: any;
  timeKey: TimeKey;
  catKey: CatKey;
  setCatKey: (v: CatKey) => void;
  q: string;
  deferredQ: string;
}) {
  const { apiData, timeKey, catKey, setCatKey, deferredQ } = args;

  const currentPeriodLabel = useMemo(() => {
    switch (timeKey) {
      case "mese":
        return "Mese";
      case "trimestre":
        return "Trimestre";
      case "semestre":
        return "Semestre";
      case "anno_fiscale":
        return "Anno fiscale";
      default:
        return "Anno";
    }
  }, [timeKey]);

  /**
   * Variants = clienti (keys reali dai months.byVariantId)
   */
  const variants = useMemo(() => {
    if (!apiData) return [];
    const keys = universeFromAnalytics(apiData);
    return keys.map((k) => ({ variantId: k, label: k }));
  }, [apiData]);

  // catKey non valido -> all
  useEffect(() => {
    if (!apiData) return;
    const allowed = new Set<string>(["all", ...variants.map((v: any) => String(v.variantId))]);
    if (!allowed.has(String(catKey))) setCatKey("all");
  }, [apiData, variants, catKey, setCatKey]);

  /**
   * Meta + tabs (solo API)
   */
  const categoryMetaLike = useMemo(() => {
    const keys = variants.map((v: any) => String(v.variantId));
    return buildCategoryMetaLikeFromApi({ keys });
  }, [variants]);

  const categoryTabItems = useMemo(() => {
    const keys = variants.map((v: any) => String(v.variantId));
    return buildCategoryTabItems({ keys, categoryMetaLike });
  }, [variants, categoryMetaLike]);

  /**
   * Totals current/prev + delta
   */
  const totals = useMemo(() => {
    if (!apiData) return { current: { valore: 0 }, prev: { valore: 0 } };
    return buildTotalsLike({ apiData, timeKey });
  }, [apiData, timeKey]);

  const currentValore = totals.current.valore ?? 0;
  const prevValore = totals.prev.valore ?? 0;

  const deltaAbs = currentValore - prevValore;
  const deltaPct = (deltaAbs / Math.max(1, prevValore)) * 100;
  const deltaIsUp = deltaAbs > 0;

  const insightLine = deltaIsUp
    ? `Conferme in crescita: ${euro(deltaAbs)} (${formatPct(deltaPct, 0)}) sul periodo precedente.`
    : `Conferme in calo: ${euro(Math.abs(deltaAbs))} (${formatPct(Math.abs(deltaPct), 0)}) sul periodo precedente.`;

  /**
   * Donut current + prev (per cliente)
   */
  const donutCurrent = useMemo(() => {
    if (!apiData) return [{ label: "Totale", value: 0 }] as DonutDatum[];
    return buildCategoriesCurrentFromApi({ apiData, timeKey, categoryMetaLike }) as DonutDatum[];
  }, [apiData, timeKey, categoryMetaLike]);

  const donutPrev = useMemo(() => {
    if (!apiData) return [{ label: "Totale", value: 0 }] as DonutDatum[];
    return buildCategoriesPrevFromApi({ apiData, timeKey, categoryMetaLike }) as DonutDatum[];
  }, [apiData, timeKey, categoryMetaLike]);

  const topCurrent = useMemo(() => pickTopCategory(donutCurrent), [donutCurrent]);

  const donutColors = useMemo(() => {
    return variants.map(
      (v: any) => categoryMetaLike[String(v.variantId)]?.color ?? colorForKey(String(v.variantId)),
    );
  }, [variants, categoryMetaLike]);

  /**
   * Upcoming (periodo + 2 mesi) + filtro ricerca
   * buildUpcomingFromApi ritorna {title,dateLabel,amount,iso}
   */
  const upcoming = useMemo(() => {
    if (!apiData) return [];
    return buildUpcomingFromApi({ apiData, timeKey }) as any[];
  }, [apiData, timeKey]);

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
   * Monthly current window + bar
   */
  const monthly = useMemo(() => {
    if (!apiData) return [];
    return buildMonthlyCurrentFromApi({ apiData, timeKey });
  }, [apiData, timeKey]);

  const barPack = useMemo(() => {
    return buildBarSeriesLike({
      catKey,
      monthly: monthly as any[],
      categoryMetaLike,
    });
  }, [catKey, monthly, categoryMetaLike]);

  const barSeries = barPack.series as BarSeries[];
  const barColors = barPack.colors as string[];
  const barStacked = !!barPack.stacked;

  /**
   * Stati avanzamento (count)
   */
  const statusBreakdown = useMemo(() => {
    if (!apiData) return [];
    return buildStatusBreakdownFromApi({ apiData });
  }, [apiData]);

  const catLabel = categoryMetaLike[String(catKey)]?.label ?? String(catKey);

  return {
    currentPeriodLabel,
    insightLine,

    variants,
    categoryMetaLike,
    categoryTabItems,

    currentValore,
    prevValore,
    deltaAbs,
    deltaPct,
    deltaIsUp,
    topCurrent,

    donutCurrent,
    donutPrev,
    donutColors,

    upcoming,
    filteredUpcoming,
    upcomingTotal,

    monthly,
    barSeries,
    barColors,
    barStacked,

    statusBreakdown,

    catLabel,
  };
}