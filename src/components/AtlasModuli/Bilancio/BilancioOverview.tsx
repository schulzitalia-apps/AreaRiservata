"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { BilancioTimeKey, BilancioTotals } from "./types";
import { computeBilancioGauge } from "./bilancio.compute";
import { BILANCIO_TIME_OPTIONS, PERIOD_LABEL } from "./config";
import { euro, signedEuro } from "./format";

import { Header } from "./components/Header";
import { Grid1 } from "./components/Grid1";
import { Grid2 } from "./components/Grid2";
import { KpiTile, IconWallet, IconReceipt, IconTrend, IconPie } from "./ui";

import { useSpeseAnalyticsSource } from "@/components/AtlasModuli/Spese/hooks/useSpeseAnalyticsSource";
import { useSpeseOverviewComputed } from "@/components/AtlasModuli/Spese/hooks/useSpeseOverviewComputed";
import { useRicaviAnalyticsSource } from "@/components/AtlasModuli/Ricavi/hooks/useRicaviAnalyticsSource";
import { useRicaviOverviewComputed } from "@/components/AtlasModuli/Ricavi/hooks/useRicaviOverviewComputed";
import { mapBilancioToModuleTimeKey, useBilancioTotals } from "./hooks/useBilancioTotals";

import { DESTINAZIONE_CONFIG, UTILE_TAX_RATE } from "./bilancio.config";
import { computeDestinazioneFromUtile, computeTaxFromUtile } from "./bilancio.kpi.compute";
import { buildMonthlyBarFromModules } from "./bilancio.monthly.live";
import { computeFiscalYearTotalsFromMonthly } from "./bilancio.fiscal";

function mergeStatus(a?: string, b?: string) {
  const s = new Set([a, b].filter(Boolean));
  if (s.has("failed")) return "failed";
  if (s.has("loading")) return "loading";
  if (s.has("succeeded")) return "succeeded";
  return a ?? b;
}

type Grid2Pack = {
  ricaviDonutData: any[];
  ricaviDonutColors: string[];
  speseDonutData: any[];
  speseDonutColors: string[];
  barCategories: string[];
  barSeries: { name: string; data: number[] }[];
  barColors: string[];
};

function splitCurrentMonths(months: any[], timeKey: BilancioTimeKey) {
  const sorted = [...(Array.isArray(months) ? months : [])].sort((a: any, b: any) =>
    String(a?.month ?? "").localeCompare(String(b?.month ?? "")),
  );

  if (!sorted.length) return [] as any[];

  if (timeKey === "anno_fiscale") {
    const lastMonth = String(sorted[sorted.length - 1]?.month ?? "");
    const year = Number(lastMonth.slice(0, 4));
    if (year) return sorted.filter((row: any) => String(row?.month ?? "").startsWith(`${year}-`));
  }

  return sorted.slice(Math.floor(sorted.length / 2));
}

function movementDateLabel(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function movementTime(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function buildLiveMovimenti(args: {
  ricaviData?: any;
  speseData?: any;
  timeKey: BilancioTimeKey;
}) {
  const rows: Array<{ id: string; title: string; dateLabel: string; amount: number; sortKey: number }> = [];

  const filterBucketToMonths = (bucket: any, months: Set<string>) => {
    const out: Record<string, any[]> = {};
    for (const variantId of Object.keys(bucket || {})) {
      out[variantId] = (Array.isArray(bucket?.[variantId]) ? bucket[variantId] : []).filter((item: any) => {
        const effectiveDate = String(
          item?.effectiveDate ?? item?.dataPagamento ?? item?.dataFatturazione ?? item?.dataSpesa ?? "",
        ).trim();
        if (!effectiveDate) return true;
        const date = new Date(effectiveDate);
        if (Number.isNaN(date.getTime())) return true;
        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        return months.has(monthKey);
      });
    }
    return out;
  };

  const pushBucket = (bucket: any, sign: 1 | -1, kind: "ricavo" | "spesa") => {
    for (const variantId of Object.keys(bucket || {})) {
      const items = Array.isArray(bucket?.[variantId]) ? bucket[variantId] : [];
      for (const item of items) {
        const title =
          String(item?.titolo ?? item?.descrizione ?? item?.title ?? (kind === "ricavo" ? "Ricavo" : "Spesa")).trim() ||
          (kind === "ricavo" ? "Ricavo" : "Spesa");
        const effectiveDate = String(
          item?.effectiveDate ?? item?.dataPagamento ?? item?.dataFatturazione ?? item?.dataSpesa ?? "",
        ).trim();
        const amount = Math.abs(Number(item?.lordo ?? item?.totaleLordo ?? item?.amount ?? 0) || 0);

        rows.push({
          id: String(item?.id ?? item?._id ?? `${kind}-${variantId}-${title}`),
          title,
          dateLabel: effectiveDate ? movementDateLabel(effectiveDate) : "—",
          amount: sign * amount,
          sortKey: movementTime(effectiveDate),
        });
      }
    }
  };

  const ricaviMonths = new Set(
    splitCurrentMonths(args.ricaviData?.months ?? [], args.timeKey).map((row: any) => String(row?.month ?? "")),
  );
  const speseMonths = new Set(
    splitCurrentMonths(args.speseData?.months ?? [], args.timeKey).map((row: any) => String(row?.month ?? "")),
  );

  pushBucket(filterBucketToMonths(args.ricaviData?.top?.paidOrInvoicedRecent, ricaviMonths), 1, "ricavo");
  pushBucket(filterBucketToMonths(args.ricaviData?.top?.programmatoRecent, ricaviMonths), 1, "ricavo");
  pushBucket(filterBucketToMonths(args.speseData?.top?.paidOrInvoicedRecent, speseMonths), -1, "spesa");
  pushBucket(filterBucketToMonths(args.speseData?.top?.programmatoRecent, speseMonths), -1, "spesa");

  const deduped = new Map<string, { id: string; title: string; dateLabel: string; amount: number; sortKey: number }>();
  for (const row of rows) {
    if (!deduped.has(row.id)) deduped.set(row.id, row);
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.sortKey - a.sortKey || Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 12)
    .map(({ sortKey, ...row }) => row);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function BilancioOverview() {
  const [timeKey, setTimeKey] = useState<BilancioTimeKey>("anno_fiscale");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [isPending, startTransition] = useTransition();

  const moduleTimeKey = mapBilancioToModuleTimeKey(timeKey);

  const speseSource = useSpeseAnalyticsSource(moduleTimeKey as any);
  const ricaviSource = useRicaviAnalyticsSource(moduleTimeKey as any);
  const speseYearSource = useSpeseAnalyticsSource("anno" as any);
  const ricaviYearSource = useRicaviAnalyticsSource("anno" as any);

  const [speseCatKey, setSpeseCatKey] = useState<any>("all");
  const [ricaviCatKey, setRicaviCatKey] = useState<any>("all");
  const [speseYearCatKey, setSpeseYearCatKey] = useState<any>("all");
  const [ricaviYearCatKey, setRicaviYearCatKey] = useState<any>("all");

  const speseComputed = useSpeseOverviewComputed({
    apiData: speseSource.apiData,
    timeKey: moduleTimeKey as any,
    catKey: speseCatKey,
    setCatKey: setSpeseCatKey,
    q: "",
    deferredQ: "",
  });
  const ricaviComputed = useRicaviOverviewComputed({
    apiData: ricaviSource.apiData,
    timeKey: moduleTimeKey as any,
    catKey: ricaviCatKey,
    setCatKey: setRicaviCatKey,
    q: "",
    deferredQ: "",
  });
  const speseYearComputed = useSpeseOverviewComputed({
    apiData: speseYearSource.apiData,
    timeKey: "anno" as any,
    catKey: speseYearCatKey,
    setCatKey: setSpeseYearCatKey,
    q: "",
    deferredQ: "",
  });
  const ricaviYearComputed = useRicaviOverviewComputed({
    apiData: ricaviYearSource.apiData,
    timeKey: "anno" as any,
    catKey: ricaviYearCatKey,
    setCatKey: setRicaviYearCatKey,
    q: "",
    deferredQ: "",
  });

  const ricaviYearMonthly = useMemo(() => (ricaviYearComputed as any).monthly ?? [], [ricaviYearComputed]);
  const speseYearMonthly = useMemo(() => (speseYearComputed as any).monthly ?? [], [speseYearComputed]);
  const ricaviSelectedMonthly = useMemo(() => (ricaviComputed as any).monthly ?? [], [ricaviComputed]);
  const speseSelectedMonthly = useMemo(() => (speseComputed as any).monthly ?? [], [speseComputed]);

  const totals = useBilancioTotals({
    bilancioTimeKey: timeKey,
    ricaviApiStatus: ricaviSource.apiStatus,
    speseApiStatus: speseSource.apiStatus,
    ricaviCurrentLordo: ricaviComputed.currentLordo,
    speseCurrentLordo: speseComputed.currentLordo,
  });

  const fiscalTotals = useMemo(
    () =>
      computeFiscalYearTotalsFromMonthly({
        ricaviMonthly: ricaviYearMonthly,
        speseMonthly: speseYearMonthly,
      }),
    [ricaviYearMonthly, speseYearMonthly],
  );

  const utileFiscale = useMemo(
    () => Number(fiscalTotals.ricavi || 0) - Number(fiscalTotals.spese || 0),
    [fiscalTotals.ricavi, fiscalTotals.spese],
  );

  const gaugeTotals: BilancioTotals = useMemo(() => {
    if (timeKey === "anno_fiscale") {
      return {
        ricavi: Number(fiscalTotals.ricavi) || 0,
        spese: Number(fiscalTotals.spese) || 0,
      };
    }
    return totals;
  }, [timeKey, fiscalTotals.ricavi, fiscalTotals.spese, totals]);

  const gauge = useMemo(() => computeBilancioGauge(gaugeTotals), [gaugeTotals]);

  const destinazione = useMemo(
    () => computeDestinazioneFromUtile({ utileAnnuale: utileFiscale, config: DESTINAZIONE_CONFIG }),
    [utileFiscale],
  );
  const tax = useMemo(
    () => computeTaxFromUtile({ utileAnnuale: utileFiscale, rate: UTILE_TAX_RATE }),
    [utileFiscale],
  );

  const insightLine = useMemo(() => {
    if (gauge.profit >= 0) {
      return `Utile di ${signedEuro(gauge.profit)} su ricavi ${euro(gauge.ricavi)} (${gauge.relativePctLabel}) nel periodo selezionato.`;
    }
    return `Perdita di ${signedEuro(gauge.profit)} su spese ${euro(gauge.spese)} (${gauge.relativePctLabel}) nel periodo selezionato.`;
  }, [gauge.profit, gauge.ricavi, gauge.spese, gauge.relativePctLabel]);

  const apiStatus = useMemo(
    () =>
      mergeStatus(
        mergeStatus(speseSource.apiStatus as any, ricaviSource.apiStatus as any),
        mergeStatus(speseYearSource.apiStatus as any, ricaviYearSource.apiStatus as any),
      ),
    [speseSource.apiStatus, ricaviSource.apiStatus, speseYearSource.apiStatus, ricaviYearSource.apiStatus],
  );
  const apiError = useMemo(
    () => speseSource.apiError ?? ricaviSource.apiError ?? speseYearSource.apiError ?? ricaviYearSource.apiError ?? null,
    [speseSource.apiError, ricaviSource.apiError, speseYearSource.apiError, ricaviYearSource.apiError],
  );

  const barPack = useMemo(() => {
    const ricaviMonthly = timeKey === "anno_fiscale" ? ricaviYearMonthly : ricaviSelectedMonthly;
    const speseMonthly = timeKey === "anno_fiscale" ? speseYearMonthly : speseSelectedMonthly;

    return buildMonthlyBarFromModules({
      timeKey,
      ricaviMonthly,
      speseMonthly,
      colors: ["#22C55E", "#EF4444"],
      tuttoMonths: 36,
    });
  }, [timeKey, ricaviYearMonthly, ricaviSelectedMonthly, speseYearMonthly, speseSelectedMonthly]);

  const movimenti = useMemo(
    () => buildLiveMovimenti({ ricaviData: ricaviSource.apiData, speseData: speseSource.apiData, timeKey }),
    [ricaviSource.apiData, speseSource.apiData, timeKey],
  );

  const barRicavi = useMemo(() => (Array.isArray(barPack.series?.[0]?.data) ? barPack.series[0].data : []), [barPack.series]);
  const barSpese = useMemo(() => (Array.isArray(barPack.series?.[1]?.data) ? barPack.series[1].data : []), [barPack.series]);
  const monthlyMargins = useMemo(
    () => barRicavi.map((value: number, index: number) => value - (barSpese[index] ?? 0)),
    [barRicavi, barSpese],
  );
  const avgMonthlyMargin = useMemo(() => average(monthlyMargins), [monthlyMargins]);
  const avgMonthlyRicavi = useMemo(() => average(barRicavi), [barRicavi]);
  const positiveMonths = useMemo(() => monthlyMargins.filter((value) => value >= 0).length, [monthlyMargins]);

  const nextGrid2Pack = useMemo<Grid2Pack>(
    () => ({
      ricaviDonutData: (ricaviComputed.categoriesCurrent as any) ?? [],
      ricaviDonutColors: ((ricaviComputed.donutColors as any) ?? ["#22C55E", "#0ABEF9"]) as any,
      speseDonutData: (speseComputed.categoriesCurrent as any) ?? [],
      speseDonutColors: ((speseComputed.donutColors as any) ?? ["#EF4444", "#FB923C"]) as any,
      barCategories: barPack.categories,
      barSeries: barPack.series as any,
      barColors: barPack.colors,
    }),
    [ricaviComputed.categoriesCurrent, ricaviComputed.donutColors, speseComputed.categoriesCurrent, speseComputed.donutColors, barPack],
  );

  const lastGoodGrid2PackRef = useRef<Grid2Pack | null>(null);
  useEffect(() => {
    if (apiStatus === "succeeded") {
      lastGoodGrid2PackRef.current = nextGrid2Pack;
    }
  }, [apiStatus, nextGrid2Pack]);

  const grid2Pack = useMemo<Grid2Pack>(() => {
    if ((apiStatus === "loading" || apiStatus === "idle") && lastGoodGrid2PackRef.current) {
      return lastGoodGrid2PackRef.current;
    }
    return nextGrid2Pack;
  }, [apiStatus, nextGrid2Pack]);

  return (
    <>
      <Header
        currentPeriodLabel={PERIOD_LABEL[timeKey]}
        timeKey={timeKey}
        setTimeKey={(value) =>
          startTransition(() => {
            setTimeKey(value);
          })
        }
        isPending={isPending}
        apiStatus={apiStatus}
        apiError={apiError}
        TIME_OPTIONS={BILANCIO_TIME_OPTIONS as any}
        insightLine={insightLine}
      />

      <Grid1
        currentPeriodLabel={PERIOD_LABEL[timeKey]}
        gauge={gauge}
        destinazione={destinazione.rows as any}
        destinazioneColors={destinazione.colors}
        q={q}
        setQ={setQ}
        deferredQ={deferredQ}
        movimenti={movimenti}
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title="Simulatore Tassa Utile"
          value={euro(tax.tax)}
          sub="Anno fiscale · 26% utile"
          icon={<IconWallet />}
        />
        <KpiTile
          title="Utile anno fiscale corrente"
          value={euro(Math.max(0, utileFiscale))}
          sub="Da Gennaio a oggi"
          icon={<IconReceipt />}
        />
        <KpiTile
          title="Margine medio mensile"
          value={signedEuro(avgMonthlyMargin)}
          sub={`${positiveMonths}/${Math.max(monthlyMargins.length, 1)} mesi positivi`}
          icon={<IconTrend />}
        />
        <KpiTile
          title="Ricavo medio mensile"
          value={euro(avgMonthlyRicavi)}
          sub={`Media su ${Math.max(barRicavi.length, 1)} mesi del filtro`}
          icon={<IconPie />}
        />
      </div>

      <div className="mt-6">
        <Grid2
          currentPeriodLabel={PERIOD_LABEL[timeKey]}
          ricaviDonutData={grid2Pack.ricaviDonutData}
          ricaviDonutColors={grid2Pack.ricaviDonutColors}
          speseDonutData={grid2Pack.speseDonutData}
          speseDonutColors={grid2Pack.speseDonutColors}
          barCategories={grid2Pack.barCategories}
          barSeries={grid2Pack.barSeries}
          barColors={grid2Pack.barColors}
          notes={[
            { label: "Utile fiscale", value: euro(Math.max(0, utileFiscale)), hint: "Da Gennaio a oggi" },
            { label: "Tassa utile", value: euro(tax.tax), hint: "26% su utile fiscale positivo" },
            { label: "Margine periodo", value: gauge.relativePctLabel, hint: "Rapporto utile/perdita sul periodo" },
            { label: "Saldo periodo", value: signedEuro(gauge.profit), hint: `${positiveMonths} mesi positivi nel filtro` },
          ]}
        />
      </div>
    </>
  );
}


