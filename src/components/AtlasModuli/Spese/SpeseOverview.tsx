"use client";

import { useDeferredValue, useState, useTransition } from "react";

// Local types
import type { TimeKey } from "./types";
import type { CatKey } from "./speseOverview.category";

// Mock/constants
import { TIME_OPTIONS } from "./mock";

// Helpers
import { euro, formatPct } from "./format";
import { colorForKey } from "./speseOverview.safe";

// UI atoms (NON TOCCARE)
import { KpiTile, DeltaPill, IconWallet, IconReceipt, IconTrend, IconPie } from "./ui";

// Hooks
import { useSpeseAnalyticsSource } from "./hooks/useSpeseAnalyticsSource";
import { useSpeseMemos } from "./hooks/useSpeseMemos";
import { useSpeseOverviewComputed } from "./hooks/useSpeseOverviewComputed";

// Components (NEW)
import { Header } from "./components/Header";
import { Grid1 } from "./components/Grid1";
import { Grid2 } from "./components/Grid2";

export default function SpeseOverview() {
  const [timeKey, setTimeKey] = useState<TimeKey>("anno");
  const [catKey, setCatKey] = useState<CatKey>("all");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [isPending, startTransition] = useTransition();

  // Data source (mock/API + fetch)
  const { useMock, setUseMock, apiData, apiStatus, apiError } =
    useSpeseAnalyticsSource(timeKey);

  // Computed data (derivati)
  const computed = useSpeseOverviewComputed({
    useMock,
    apiData,
    timeKey,
    catKey,
    setCatKey,
    q,
    deferredQ,
  });

  // Memo state
  const memo = useSpeseMemos(timeKey);

  const catColor =
    computed.categoryMetaLike[String(catKey)]?.color ?? colorForKey(String(catKey));

  return (
    <>
      <Header
        currentPeriodLabel={computed.currentPeriodLabel}
        timeKey={timeKey}
        setTimeKey={(v) =>
          startTransition(() => {
            setTimeKey(v);
          })
        }
        setCatKeyAll={() => setCatKey("all")}
        isPending={isPending}
        useMock={useMock}
        toggleUseMock={() => setUseMock((v) => !v)}
        apiStatus={apiStatus}
        apiError={apiError}
        TIME_OPTIONS={TIME_OPTIONS as any}
        insightLine={computed.insightLine}
      />

      <Grid1
        currentPeriodLabel={computed.currentPeriodLabel}
        categoriesPrev={computed.categoriesPrev}
        gaugePercent={computed.gaugePercent}
        gaugeSubtitle={computed.gaugeSubtitle}
        deltaIsUp={computed.deltaIsUp}
        categoriesCurrent={computed.categoriesCurrent}
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
          title="Totale spese"
          value={euro(computed.currentLordo)}
          sub={`Periodo: ${computed.currentPeriodLabel}`}
          right={<DeltaPill deltaPct={computed.deltaPct} />}
          icon={<IconWallet />}
        />
        <KpiTile
          title="IVA recuperata"
          value={euro(computed.currentIva)}
          sub="Stima periodo corrente"
          icon={<IconReceipt />}
        />
        <KpiTile
          title="Scostamento"
          value={`${computed.deltaAbs >= 0 ? "+" : ""}${euro(computed.deltaAbs)}`}
          sub={`${euro(computed.prevLordo)} nel periodo precedente`}
          right={<DeltaPill deltaPct={computed.deltaPct} showArrow />}
          icon={<IconTrend />}
        />
        <KpiTile
          title="Driver principale"
          value={computed.topCurrent?.label ?? "—"}
          sub={`${formatPct(
            ((computed.topCurrent?.value ?? 0) / Math.max(1, computed.currentLordo)) * 100,
            0,
          )} · ${euro(computed.topCurrent?.value ?? 0)}`}
          icon={<IconPie />}
        />
      </div>

      <Grid2
        top10={computed.top10}
        catLabel={computed.catLabel}
        currentPeriodLabel={computed.currentPeriodLabel}
        catKey={catKey}
        setCatKey={setCatKey}
        categoryTabItems={computed.categoryTabItems}
        barSeries={computed.barSeries}
        barColors={computed.barColors}
        catColor={catColor}
        memos={memo.memos}
        memoOpen={memo.memoOpen}
        setMemoOpen={memo.setMemoOpen}
        memoTitle={memo.memoTitle}
        setMemoTitle={memo.setMemoTitle}
        memoDate={memo.memoDate}
        setMemoDate={memo.setMemoDate}
        memoAmount={memo.memoAmount}
        setMemoAmount={memo.setMemoAmount}
        onAddMemo={memo.onAddMemo}
      />
    </>
  );
}
