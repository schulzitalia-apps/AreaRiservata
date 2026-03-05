"use client";

import { useDeferredValue, useState, useTransition } from "react";

// Local types
import type { TimeKey } from "./types";
import type { CatKey } from "./types";

// Helpers
import { euro, formatPct, clamp } from "./format";
import { colorForKey } from "./confermeOrdine.safe";

// UI atoms
import { KpiTile, DeltaPill, IconWallet, IconReceipt, IconTrend, IconPie } from "./ui";

// Hooks (NO MOCK)
import { useConfermeOrdineAnalyticsSource } from "./hooks/useConfermeOrdineAnalyticsSource";
import { useConfermeOrdineOverviewComputed } from "./hooks/useConfermeOrdineOverviewComputed";

// Components
import { Header } from "./components/Header";
import { Grid1 } from "./components/Grid1";
import { Grid2 } from "./components/Grid2";

// Tabs globali
import { CategoryTabsDyn } from "./CategoryTabsDyn";

/** Time options (solo UI select) */
const TIME_OPTIONS: Array<{ value: TimeKey; label: string }> = [
  { value: "mese", label: "Mese" },
  { value: "trimestre", label: "Trimestre" },
  { value: "semestre", label: "Semestre" },
  { value: "anno", label: "Anno" },
  { value: "anno_fiscale", label: "Anno fiscale" },
];

export default function ConfermeOrdineOverview() {
  const [timeKey, setTimeKey] = useState<TimeKey>("anno");
  const [catKey, setCatKey] = useState<CatKey>("all");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [isPending, startTransition] = useTransition();

  // Data source (API + fetch)
  const { apiData, apiStatus, apiError } = useConfermeOrdineAnalyticsSource(timeKey);

  // Computed data
  const computed = useConfermeOrdineOverviewComputed({
    apiData,
    timeKey,
    catKey,
    setCatKey,
    q,
    deferredQ,
  });

  const catColor =
    computed.categoryMetaLike?.[String(catKey)]?.color ?? colorForKey(String(catKey));

  // Gauge (avanzamento valore) — se non lo calcoli già nel computed
  const gaugePercent = clamp((computed.currentValore / Math.max(1, computed.prevValore)) * 100, 0, 200);
  const gaugeSubtitle = `${euro(computed.currentValore)} / ${euro(computed.prevValore)} (${Math.round(gaugePercent)}%)`;

  return (
    <>
      <Header
        currentPeriodLabel={computed.currentPeriodLabel}
        timeKey={timeKey}
        setTimeKey={(v) => startTransition(() => setTimeKey(v))}
        setCatKeyAll={() => setCatKey("all")}
        isPending={isPending}
        apiStatus={apiStatus}
        apiError={apiError}
        TIME_OPTIONS={TIME_OPTIONS as any}
        insightLine={computed.insightLine}
      />

      <Grid1
        currentPeriodLabel={computed.currentPeriodLabel}
        categoriesPrev={computed.donutPrev}
        gaugePercent={gaugePercent}
        gaugeSubtitle={gaugeSubtitle}
        deltaIsUp={computed.deltaIsUp}
        categoriesCurrent={computed.donutCurrent}
        donutColors={computed.donutColors as any}
        q={q}
        setQ={setQ}
        deferredQ={deferredQ}
        filteredUpcoming={computed.filteredUpcoming}
        upcomingTotal={computed.upcomingTotal}
      />

      {/* KPI FULL WIDTH */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title="Totale conferme"
          value={euro(computed.currentValore)}
          sub={`Periodo: ${computed.currentPeriodLabel}`}
          right={<DeltaPill deltaPct={computed.deltaPct} />}
          icon={<IconWallet />}
        />
        <KpiTile
          title="Prossime consegne"
          value={euro(computed.upcomingTotal)}
          sub="Finestra: periodo + 2 mesi"
          icon={<IconReceipt />}
        />
        <KpiTile
          title="Scostamento"
          value={`${computed.deltaAbs >= 0 ? "+" : ""}${euro(computed.deltaAbs)}`}
          sub={`${euro(computed.prevValore)} nel periodo precedente`}
          right={<DeltaPill deltaPct={computed.deltaPct} showArrow />}
          icon={<IconTrend />}
        />
        <KpiTile
          title="Cliente principale"
          value={computed.topCurrent?.label ?? "—"}
          sub={`${formatPct(
            ((computed.topCurrent?.value ?? 0) / Math.max(1, computed.currentValore)) * 100,
            0,
          )} · ${euro(computed.topCurrent?.value ?? 0)}`}
          icon={<IconPie />}
        />
      </div>

      <Grid2
        catLabel={computed.catLabel}
        currentPeriodLabel={computed.currentPeriodLabel}
        catKey={catKey}
        setCatKey={setCatKey}
        categoryTabItems={computed.categoryTabItems}
        barSeries={computed.barSeries}
        barColors={computed.barColors}
        barStacked={computed.barStacked}
        catColor={catColor}
        statusBreakdown={computed.statusBreakdown}
        CategoryTabsDyn={CategoryTabsDyn as any}
      />
    </>
  );
}