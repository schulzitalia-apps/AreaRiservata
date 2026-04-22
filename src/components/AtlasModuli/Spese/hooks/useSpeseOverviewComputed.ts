import { useEffect, useMemo } from "react";
import type { DonutDatum } from "@/components/Charts/ui/ApexDonutChart";
import type { BarSeries } from "@/components/Charts/ui/ApexBarChart";
import { euro, clamp, formatPct } from "../format";
import { pickTopCategory } from "../calc";
import { colorForKey } from "../speseOverview.safe";
import { CATEGORY_META, PERIOD_LABEL, DONUT_COLORS, buildEmptyTotalsLike } from "../config";
import type { TimeKey } from "../types";
import type { VariantItem, CatKey } from "../speseOverview.category";
import {
  universeFromAnalytics,
  buildTotalsLikeFromApi,
  buildCategoriesPrevFromApi,
  buildCategoriesCurrent,
  buildMonthlyFromApi,
  buildBarSeriesLike,
  buildTop5FromApi,
  buildUpcomingIpotizzatoFromApi,
} from "../speseOverview.api-adapters";
import { buildCategoryMetaLike, buildCategoryTabItems } from "../speseOverview.category";

export function useSpeseOverviewComputed(args: {
  apiData?: any;
  timeKey: TimeKey;
  catKey: CatKey;
  setCatKey: (value: CatKey) => void;
  q: string;
  deferredQ: string;
  variantLabelById?: Record<string, string>;
}) {
  const { apiData, timeKey, catKey, setCatKey, deferredQ, variantLabelById } = args;
  const currentPeriodLabel = PERIOD_LABEL[timeKey];

  const variants: VariantItem[] = useMemo(() => {
    if (!apiData) return [];
    return universeFromAnalytics(apiData).map((variantId) => ({
      variantId,
      label: variantLabelById?.[variantId] ?? CATEGORY_META[variantId]?.label ?? variantId,
    }));
  }, [apiData, variantLabelById]);

  useEffect(() => {
    const allowed = new Set<string>(["all", ...variants.map((variant) => String(variant.variantId))]);
    if (!allowed.has(String(catKey))) setCatKey("all");
  }, [variants, catKey, setCatKey]);

  const categoryMetaLike = useMemo(
    () =>
      buildCategoryMetaLike({
        baseMeta: CATEGORY_META,
        variants,
      }),
    [variants],
  );

  const categoryTabItems = useMemo(
    () =>
      buildCategoryTabItems({
        variants,
        categoryMetaLike,
      }),
    [variants, categoryMetaLike],
  );

  const totalsLike = useMemo(() => (apiData ? buildTotalsLikeFromApi({ apiData, timeKey }) : buildEmptyTotalsLike()), [apiData, timeKey]);
  const currentLordo = totalsLike[timeKey].current.lordo;
  const currentIva = totalsLike[timeKey].current.ivaRecuperata;
  const prevLordo = totalsLike[timeKey].prev.lordo;

  const categoriesCurrent = useMemo(
    () => buildCategoriesCurrent({ apiData, timeKey, variants, categoryMetaLike }),
    [apiData, timeKey, variants, categoryMetaLike],
  );

  const categoriesPrev = useMemo(
    () => buildCategoriesPrevFromApi({ apiData, timeKey, variants, categoryMetaLike }),
    [apiData, timeKey, variants, categoryMetaLike],
  );

  const deltaAbs = currentLordo - prevLordo;
  const deltaPct = (deltaAbs / Math.max(1, prevLordo)) * 100;
  const deltaIsUp = deltaAbs > 0;

  const topCurrent = useMemo(() => pickTopCategory(categoriesCurrent as DonutDatum[]), [categoriesCurrent]);
  const gaugePercent = clamp((currentLordo / Math.max(1, prevLordo)) * 100, 0, 200);
  const gaugeSubtitle = `${euro(currentLordo)} / ${euro(prevLordo)} (${Math.round(gaugePercent)}%)`;

  const insightLine = deltaIsUp
    ? `Spesa operativa in crescita: ${euro(deltaAbs)} (${formatPct(deltaPct, 0)}) sul periodo precedente.`
    : `Spesa operativa in contrazione: ${euro(Math.abs(deltaAbs))} (${formatPct(Math.abs(deltaPct), 0)}) sul periodo precedente.`;

  const upcoming = useMemo(() => buildUpcomingIpotizzatoFromApi({ apiData }) as any[], [apiData]);

  const filteredUpcoming = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    if (!query) return upcoming;
    return upcoming.filter((row: any) => `${row.title} ${row.dateLabel}`.toLowerCase().includes(query));
  }, [upcoming, deferredQ]);

  const upcomingTotal = useMemo(() => filteredUpcoming.reduce((sum: number, row: any) => sum + (row.amount ?? 0), 0), [filteredUpcoming]);
  const monthly = useMemo(() => (apiData ? buildMonthlyFromApi({ apiData, timeKey }) : []), [apiData, timeKey]);

  const barPack = useMemo(
    () =>
      buildBarSeriesLike({
        catKey,
        monthly: monthly as any[],
        categoryMetaLike,
      }),
    [catKey, monthly, categoryMetaLike],
  );

  const top10 = useMemo(
    () =>
      buildTop5FromApi({
        apiData,
        catKey,
        timeKey,
        bucket: "currentPeriodTop",
      }).slice(0, 5),
    [apiData, catKey, timeKey],
  );

  const catLabel = categoryMetaLike[String(catKey)]?.label ?? String(catKey);
  const catColor = categoryMetaLike[String(catKey)]?.color ?? colorForKey(String(catKey));
  const donutColors = variants.length
    ? (variants.map((variant) => categoryMetaLike[variant.variantId]?.color ?? colorForKey(variant.variantId)) as any)
    : DONUT_COLORS;

  return {
    currentPeriodLabel,
    insightLine,
    variants,
    categoryMetaLike,
    categoryTabItems,
    currentLordo,
    currentIva,
    prevLordo,
    deltaAbs,
    deltaPct,
    deltaIsUp,
    topCurrent,
    gaugePercent,
    gaugeSubtitle,
    categoriesCurrent,
    categoriesPrev,
    donutColors,
    upcoming,
    filteredUpcoming,
    upcomingTotal,
    monthly,
    barSeries: barPack.series as BarSeries[],
    barColors: barPack.colors as string[],
    top10,
    catLabel,
    catColor,
  };
}
