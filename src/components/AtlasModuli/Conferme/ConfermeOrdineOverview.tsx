"use client";

import { useDeferredValue, useState, useTransition } from "react";

import type { TimeKey } from "./types";
import type { CatKey } from "./types";

import { euro, formatPct, clamp } from "./format";
import { colorForKey } from "./confermeOrdine.safe";

import {
  KpiTile,
  DeltaPill,
  IconWallet,
  IconReceipt,
  IconTrend,
  IconPie,
  Card,
  CardHeader,
} from "./ui";

import { useConfermeOrdineAnalyticsSource } from "./hooks/useConfermeOrdineAnalyticsSource";
import { useConfermeOrdineOverviewComputed } from "./hooks/useConfermeOrdineOverviewComputed";

import { Header } from "./components/Header";
import { Grid1 } from "./components/Grid1";
import { Grid2 } from "./components/Grid2";

import { CategoryTabsDyn } from "./CategoryTabsDyn";

const TIME_OPTIONS: Array<{ value: TimeKey; label: string }> = [
  { value: "mese", label: "Mese" },
  { value: "trimestre", label: "Trimestre" },
  { value: "semestre", label: "Semestre" },
  { value: "anno", label: "Anno" },
  { value: "anno_fiscale", label: "Anno fiscale" },
];

function colorAt(colors: string[] | undefined, index: number) {
  if (!colors?.length) return "#94A3B8";
  return colors[index % colors.length] ?? "#94A3B8";
}

export default function ConfermeOrdineOverview() {
  const [timeKey, setTimeKey] = useState<TimeKey>("anno");
  const [catKey, setCatKey] = useState<CatKey>("all");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [isPending, startTransition] = useTransition();

  const { apiData, apiStatus, apiError } = useConfermeOrdineAnalyticsSource(timeKey);

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

  const gaugePercent = clamp(
    (computed.currentValore / Math.max(1, computed.prevValore)) * 100,
    0,
    200,
  );
  const gaugeSubtitle = `${euro(computed.currentValore)} / ${euro(computed.prevValore)} (${Math.round(gaugePercent)}%)`;

  const customerRanking = [...(computed.donutCurrent ?? [])]
    .sort((a: any, b: any) => Number(b?.value ?? 0) - Number(a?.value ?? 0))
    .filter((item: any) => Number(item?.value ?? 0) > 0)
    .map((item: any, index: number) => ({
      label: item?.label ?? "-",
      value: Number(item?.value ?? 0),
      color: colorAt(computed.donutColors, index),
    }));

  const customerOrderCountRanking = [...(computed.customerOrderCountRanking ?? [])]
    .filter((item: any) => Number(item?.value ?? 0) > 0)
    .map((item: any, index: number) => ({
      label: item?.label ?? "-",
      value: Number(item?.value ?? 0),
      color: colorAt(computed.donutColors, index),
    }));

  const customerValuePerOrderRanking = [...(computed.customerValuePerOrderRanking ?? [])]
    .filter((item: any) => Number(item?.count ?? 0) > 0)
    .map((item: any, index: number) => ({
      label: item?.label ?? "-",
      value: Number(item?.value ?? 0),
      count: Number(item?.count ?? 0),
      total: Number(item?.total ?? 0),
      color: colorAt(computed.donutColors, index),
    }));

  return (
    <>
      <Header
        currentPeriodLabel={computed.currentPeriodLabel}
        currentCount={computed.currentCount}
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
          value={computed.topCurrent?.label ?? "-"}
          sub={`${formatPct(
            ((computed.topCurrent?.value ?? 0) / Math.max(1, computed.currentValore)) * 100,
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
        barStacked={computed.barStacked}
        catColor={catColor}
        statusBreakdown={computed.statusBreakdown}
        CategoryTabsDyn={CategoryTabsDyn as any}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Clienti per fatturato"
            subTitle={`Periodo corrente (${computed.currentPeriodLabel})`}
          />
          <div className="px-4 pb-5 pt-1">
            <div className="max-h-[320px] overflow-auto rounded-2xl border border-stroke/70 bg-white/40 p-3 [scrollbar-width:thin] dark:border-dark-3/70 dark:bg-gray-dark/20">
              <div className="space-y-2">
                {customerRanking.map((item) => (
                  <div
                    key={`${item.label}-${item.color}-value`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-stroke/50 bg-white/60 px-3 py-2 dark:border-dark-3/60 dark:bg-gray-dark/35"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="break-words text-sm font-semibold text-dark dark:text-white/85">
                        {item.label}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold text-dark dark:text-white">
                      {euro(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Clienti per numero ordini"
            subTitle={`Periodo corrente (${computed.currentPeriodLabel})`}
          />
          <div className="px-4 pb-5 pt-1">
            <div className="max-h-[320px] overflow-auto rounded-2xl border border-stroke/70 bg-white/40 p-3 [scrollbar-width:thin] dark:border-dark-3/70 dark:bg-gray-dark/20">
              <div className="space-y-2">
                {customerOrderCountRanking.map((item) => (
                  <div
                    key={`${item.label}-${item.color}-count`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-stroke/50 bg-white/60 px-3 py-2 dark:border-dark-3/60 dark:bg-gray-dark/35"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="break-words text-sm font-semibold text-dark dark:text-white/85">
                        {item.label}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold text-dark dark:text-white">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Rapporto fatturato / conferme"
            subTitle={`Periodo corrente (${computed.currentPeriodLabel})`}
          />
          <div className="px-4 pb-5 pt-1">
            <div className="max-h-[320px] overflow-auto rounded-2xl border border-stroke/70 bg-white/40 p-3 [scrollbar-width:thin] dark:border-dark-3/70 dark:bg-gray-dark/20">
              <div className="space-y-2">
                {customerValuePerOrderRanking.map((item) => (
                  <div
                    key={`${item.label}-${item.color}-ratio`}
                    className="rounded-xl border border-stroke/50 bg-white/60 px-3 py-2 dark:border-dark-3/60 dark:bg-gray-dark/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: item.color }}
                        />
                        <span className="break-words text-sm font-semibold text-dark dark:text-white/85">
                          {item.label}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold text-dark dark:text-white">
                        {euro(item.value)}
                      </span>
                    </div>
                    <div className="mt-1 pl-[18px] text-xs font-semibold text-gray-600 dark:text-dark-6">
                      {item.count} conferme · {euro(item.total)} totali
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
