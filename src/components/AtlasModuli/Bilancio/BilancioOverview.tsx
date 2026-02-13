"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { BilancioTimeKey, BilancioTotals } from "./types";
import { computeBilancioGauge } from "./bilancio.compute";
import {
  BILANCIO_MOVIMENTI_MOCK,
  BILANCIO_TIME_OPTIONS,
  BILANCIO_TILES_MOCK,
  PERIOD_LABEL,
} from "./mock";
import { euro, signedEuro } from "./format";

import { Header } from "./components/Header";
import { Grid1 } from "./components/Grid1";
import { Grid2 } from "./components/Grid2";

import { KpiTile, IconWallet, IconReceipt, IconTrend, IconPie } from "./ui";

// Hooks moduli (non tocchiamo)
import { useSpeseAnalyticsSource } from "@/components/AtlasModuli/Spese/hooks/useSpeseAnalyticsSource";
import { useSpeseOverviewComputed } from "@/components/AtlasModuli/Spese/hooks/useSpeseOverviewComputed";

import { useRicaviAnalyticsSource } from "@/components/AtlasModuli/Ricavi/hooks/useRicaviAnalyticsSource";
import { useRicaviOverviewComputed } from "@/components/AtlasModuli/Ricavi/hooks/useRicaviOverviewComputed";

import { mapBilancioToModuleTimeKey, useBilancioTotals } from "./hooks/useBilancioTotals";

// KPI/config
import { DESTINAZIONE_CONFIG, UTILE_TAX_RATE } from "./bilancio.config";
import { computeDestinazioneFromUtile, computeTaxFromUtile } from "./bilancio.kpi.compute";

// Monthly chart
import { buildMonthlyBarFromModules } from "./bilancio.monthly.live";

// ✅ Fiscal year (da Gennaio)
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

export default function BilancioOverview() {
  // ✅ default preferito: anno fiscale
  const [timeKey, setTimeKey] = useState<BilancioTimeKey>("anno_fiscale");

  // Switch unico bilancio (mock/API)
  const [useMock, setUseMock] = useState(false);

  // movimenti search (mock per ora)
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);

  const [isPending, startTransition] = useTransition();

  /**
   * Per i grafici “filtrati” usiamo il mapping:
   * - anno_fiscale -> anno (per avere monthly 12 mesi disponibili dai moduli)
   * - tutto -> anno (per ora)
   */
  const moduleTimeKey = mapBilancioToModuleTimeKey(timeKey);

  /**
   * 🔹 SOURCES per filtro UI
   */
  const speseSource = useSpeseAnalyticsSource(moduleTimeKey as any);
  const ricaviSource = useRicaviAnalyticsSource(moduleTimeKey as any);

  /**
   * 🔹 SOURCES “ANNO” (sempre) per KPI FISSI (YTD fiscale)
   */
  const speseYearSource = useSpeseAnalyticsSource("anno" as any);
  const ricaviYearSource = useRicaviAnalyticsSource("anno" as any);

  // ✅ quando switcho Bilancio, imposto useMock su tutti i source
  useEffect(() => {
    speseSource.setUseMock(useMock);
    ricaviSource.setUseMock(useMock);
    speseYearSource.setUseMock(useMock);
    ricaviYearSource.setUseMock(useMock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useMock]);

  // catKey state (non la usiamo veramente)
  const [speseCatKey, setSpeseCatKey] = useState<any>("all");
  const [ricaviCatKey, setRicaviCatKey] = useState<any>("all");

  const [speseYearCatKey, setSpeseYearCatKey] = useState<any>("all");
  const [ricaviYearCatKey, setRicaviYearCatKey] = useState<any>("all");

  /**
   * 🔹 COMPUTED per filtro UI
   */
  const speseComputed = useSpeseOverviewComputed({
    useMock: speseSource.useMock,
    apiData: speseSource.apiData,
    timeKey: moduleTimeKey as any,
    catKey: speseCatKey,
    setCatKey: setSpeseCatKey,
    q: "",
    deferredQ: "",
  });

  const ricaviComputed = useRicaviOverviewComputed({
    useMock: ricaviSource.useMock,
    apiData: ricaviSource.apiData,
    timeKey: moduleTimeKey as any,
    catKey: ricaviCatKey,
    setCatKey: setRicaviCatKey,
    q: "",
    deferredQ: "",
  });

  /**
   * 🔹 COMPUTED “ANNO” (sempre) per KPI FISSI
   */
  const speseYearComputed = useSpeseOverviewComputed({
    useMock: speseYearSource.useMock,
    apiData: speseYearSource.apiData,
    timeKey: "anno" as any,
    catKey: speseYearCatKey,
    setCatKey: setSpeseYearCatKey,
    q: "",
    deferredQ: "",
  });

  const ricaviYearComputed = useRicaviOverviewComputed({
    useMock: ricaviYearSource.useMock,
    apiData: ricaviYearSource.apiData,
    timeKey: "anno" as any,
    catKey: ricaviYearCatKey,
    setCatKey: setRicaviYearCatKey,
    q: "",
    deferredQ: "",
  });

  /**
   * Totals bilancio per filtro UI (serve al gauge nei filtri NON fiscali)
   */
  const totals = useBilancioTotals({
    bilancioTimeKey: timeKey,
    bilancioUseMock: useMock,

    ricaviSourceUseMock: ricaviSource.useMock,
    speseSourceUseMock: speseSource.useMock,
    ricaviApiStatus: ricaviSource.apiStatus,
    speseApiStatus: speseSource.apiStatus,

    ricaviCurrentLordo: ricaviComputed.currentLordo,
    speseCurrentLordo: speseComputed.currentLordo,
  });

  /**
   * ✅ Totali fiscali (Gennaio → oggi) calcolati SEMPRE da monthly annuale
   */
  const fiscalTotals = useMemo(() => {
    return computeFiscalYearTotalsFromMonthly({
      ricaviMonthly: (ricaviYearComputed as any).monthly ?? [],
      speseMonthly: (speseYearComputed as any).monthly ?? [],
    });
  }, [(ricaviYearComputed as any).monthly, (speseYearComputed as any).monthly]);

  const utileFiscale = useMemo(() => {
    return Math.round((fiscalTotals.ricavi || 0) - (fiscalTotals.spese || 0));
  }, [fiscalTotals.ricavi, fiscalTotals.spese]);

  /**
   * ✅ FIX: tachimetro usa fiscalTotals se anno_fiscale
   */
  const gaugeTotals: BilancioTotals = useMemo(() => {
    if (timeKey === "anno_fiscale") {
      return {
        ricavi: Math.round(Number(fiscalTotals.ricavi) || 0),
        spese: Math.round(Number(fiscalTotals.spese) || 0),
      };
    }
    return totals;
  }, [timeKey, fiscalTotals.ricavi, fiscalTotals.spese, totals]);

  const gauge = useMemo(
    () => computeBilancioGauge(gaugeTotals),
    [gaugeTotals.ricavi, gaugeTotals.spese],
  );

  /**
   * ✅ Destinazione utile — SEMPRE su utile fiscale (clamped)
   */
  const destinazione = useMemo(() => {
    return computeDestinazioneFromUtile({
      utileAnnuale: utileFiscale,
      config: DESTINAZIONE_CONFIG,
    });
  }, [utileFiscale]);

  /**
   * ✅ Tassa utile — SEMPRE su utile fiscale
   */
  const tax = useMemo(() => {
    return computeTaxFromUtile({ utileAnnuale: utileFiscale, rate: UTILE_TAX_RATE });
  }, [utileFiscale]);

  /**
   * insight line in header (coerente col gauge)
   */
  const insightLine = useMemo(() => {
    const p = gauge.profit;
    if (p >= 0) {
      return `Utile di ${signedEuro(p)} su ricavi ${euro(gauge.ricavi)} (${gauge.relativePctLabel}) nel periodo selezionato.`;
    }
    return `Perdita di ${signedEuro(p)} su spese ${euro(gauge.spese)} (${gauge.relativePctLabel}) nel periodo selezionato.`;
  }, [gauge.profit, gauge.ricavi, gauge.spese, gauge.relativePctLabel]);

  // api status aggregato (spese+ricavi + annuali)
  const apiStatus = useMemo(() => {
    if (useMock) return "idle";
    return mergeStatus(
      mergeStatus(speseSource.apiStatus as any, ricaviSource.apiStatus as any),
      mergeStatus(speseYearSource.apiStatus as any, ricaviYearSource.apiStatus as any),
    );
  }, [
    useMock,
    speseSource.apiStatus,
    ricaviSource.apiStatus,
    speseYearSource.apiStatus,
    ricaviYearSource.apiStatus,
  ]);

  const apiError = useMemo(() => {
    if (useMock) return null;
    return (
      speseSource.apiError ??
      ricaviSource.apiError ??
      speseYearSource.apiError ??
      ricaviYearSource.apiError ??
      null
    );
  }, [
    useMock,
    speseSource.apiError,
    ricaviSource.apiError,
    speseYearSource.apiError,
    ricaviYearSource.apiError,
  ]);

  /**
   * Movimenti/tiles (mock per ora).
   */
  const movimenti = (BILANCIO_MOVIMENTI_MOCK as any)[timeKey] ?? (BILANCIO_MOVIMENTI_MOCK as any).anno;
  const tiles = (BILANCIO_TILES_MOCK as any)[timeKey] ?? (BILANCIO_TILES_MOCK as any).anno;

  /**
   * ✅ ISTOGRAMMA (come avevi)
   */
  const barPack = useMemo(() => {
    const ricaviMonthly =
      timeKey === "anno_fiscale"
        ? (ricaviYearComputed as any).monthly ?? []
        : (ricaviComputed as any).monthly ?? [];

    const speseMonthly =
      timeKey === "anno_fiscale"
        ? (speseYearComputed as any).monthly ?? []
        : (speseComputed as any).monthly ?? [];

    return buildMonthlyBarFromModules({
      timeKey,
      ricaviMonthly,
      speseMonthly,
      colors: ["#22C55E", "#EF4444"],
      tuttoMonths: 36,
    });
  }, [
    timeKey,
    (ricaviComputed as any).monthly,
    (speseComputed as any).monthly,
    (ricaviYearComputed as any).monthly,
    (speseYearComputed as any).monthly,
  ]);

  /* ------------------------------------------------------------------ */
  /* ✅ ANTI-FLASH PACK per Grid2                                        */
  /* ------------------------------------------------------------------ */

  const nextGrid2Pack = useMemo<Grid2Pack>(() => {
    return {
      ricaviDonutData: (ricaviComputed.categoriesCurrent as any) ?? [],
      ricaviDonutColors: ((ricaviComputed.donutColors as any) ?? ["#22C55E", "#0ABEF9"]) as any,
      speseDonutData: (speseComputed.categoriesCurrent as any) ?? [],
      speseDonutColors: ((speseComputed.donutColors as any) ?? ["#EF4444", "#FB923C"]) as any,
      barCategories: barPack.categories,
      barSeries: barPack.series as any,
      barColors: barPack.colors,
    };
  }, [
    ricaviComputed.categoriesCurrent,
    ricaviComputed.donutColors,
    speseComputed.categoriesCurrent,
    speseComputed.donutColors,
    barPack.categories,
    barPack.series,
    barPack.colors,
  ]);

  const lastGoodGrid2PackRef = useRef<Grid2Pack | null>(null);

  // aggiorna “last good” SOLO quando API ha finito (o quando sei in mock)
  useEffect(() => {
    if (useMock) {
      lastGoodGrid2PackRef.current = nextGrid2Pack;
      return;
    }
    if (apiStatus === "succeeded") {
      lastGoodGrid2PackRef.current = nextGrid2Pack;
    }
  }, [useMock, apiStatus, nextGrid2Pack]);

  const grid2Pack = useMemo<Grid2Pack>(() => {
    // in mock: sempre subito (nessun problema)
    if (useMock) return nextGrid2Pack;

    // in API:
    // - se sto caricando/idle e ho già un pack buono → tienilo (no flash)
    if ((apiStatus === "loading" || apiStatus === "idle") && lastGoodGrid2PackRef.current) {
      return lastGoodGrid2PackRef.current;
    }

    // - se non ho ancora nulla (primo load) → mostra comunque quello che hai (probabilmente vuoto),
    //   ma qui idealmente hai overlay globale
    return nextGrid2Pack;
  }, [useMock, apiStatus, nextGrid2Pack]);

  return (
    <>
      <Header
        currentPeriodLabel={PERIOD_LABEL[timeKey]}
        timeKey={timeKey}
        setTimeKey={(v) =>
          startTransition(() => {
            setTimeKey(v);
          })
        }
        isPending={isPending}
        useMock={useMock}
        toggleUseMock={() => setUseMock((v) => !v)}
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

      {/* 4 tiles sotto */}
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
          title="Bilancio TFR"
          value={euro(tiles.k3)}
          sub="Legato a filtri temporali"
          icon={<IconTrend />}
        />
        <KpiTile
          title="Media bilancio trimestrale"
          value={euro(tiles.k4)}
          sub="Legato a filtri temporali"
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
            { label: "Utile fiscale (live)", value: euro(Math.max(0, utileFiscale)), hint: "Da Gennaio a oggi" },
            { label: "Tassa utile (live)", value: euro(tax.tax), hint: "26% su utile fiscale positivo" },
            { label: "Margine periodo", value: gauge.relativePctLabel, hint: "Su ricavi/spese del filtro" },
            { label: "Saldo periodo", value: signedEuro(gauge.profit) },
          ]}
        />
      </div>
    </>
  );
}
