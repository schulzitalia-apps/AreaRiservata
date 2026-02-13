"use client";

import { useEffect, useMemo } from "react";
import { FloatingModal } from "@/components/ui/FloatingModal";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchAnagraficheFieldStats,
  selectAnagraficheFieldStatsEntry,
} from "@/components/Store/slices/statsSlice";
import type { AnagraficheFieldStatsResponse } from "@/components/Store/models/stats";
import { cn } from "@/server-utils/lib/utils";

import { ApexDonutChart } from "@/components/Charts/ui/ApexDonutChart";
import { ApexBarChart } from "@/components/Charts/ui/ApexBarChart";

function formatDateLike(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function KindBadge({ kind }: { kind: "select" | "date" | "number" }) {
  const label = kind === "select" ? "Select" : kind === "date" ? "Date" : "Number";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        "border-emerald-400/70 text-emerald-700 bg-emerald-500/[0.08]",
        "dark:border-emerald-300/60 dark:text-emerald-200 dark:bg-emerald-400/[0.10]",
      )}
    >
      Tipo: {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stroke px-3 py-2 dark:border-dark-3">
      <div className="text-xs text-dark/60 dark:text-white/60">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-dark dark:text-white">{value}</div>
    </div>
  );
}

function SelectCharts({ stats }: { stats: Extract<AnagraficheFieldStatsResponse, { kind: "select" }> }) {
  const my = stats.data.myValue;

  const donutData = [
    { label: my || "(vuoto)", value: stats.data.myCount },
    { label: "Altri", value: stats.data.othersCount },
  ];

  const top = stats.data.counts.slice(0, 10);
  const barSeries = [
    {
      name: "Occorrenze",
      data: top.map((c) => ({ x: c.value, y: c.count })),
    },
  ];

  const pointColors = top.map((c) => (c.value === my ? "#10B981" : "#5750F1"));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <StatCard label="Totale visibili" value={stats.totalAll} />
        <StatCard label="Validi" value={stats.totalValid} />
        <StatCard label="Vuoti/invalidi" value={stats.missingCount} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-stroke p-3 dark:border-dark-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-dark dark:text-white">Mio vs Altri</div>
            <div className="text-xs text-dark/60 dark:text-white/60">
              {stats.data.myPercent}% / {stats.data.othersPercent}%
            </div>
          </div>
          <ApexDonutChart data={donutData} title="Totale" height={300} />
        </div>

        <div className="rounded-xl border border-stroke p-3 dark:border-dark-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-dark dark:text-white">Distribuzione (top 10)</div>
            <div className="text-xs text-dark/60 dark:text-white/60">evidenziato: {my || "(vuoto)"}</div>
          </div>

          <ApexBarChart
            height={300}
            series={barSeries}
            colors={pointColors}
            distributed
            options={{
              plotOptions: { bar: { columnWidth: "55%" } },
              xaxis: { labels: { rotate: -25 } },
              tooltip: { x: { show: true } },
              legend: { show: false },
            }}
          />
        </div>
      </div>
    </div>
  );
}

function DateCharts({ stats }: { stats: Extract<AnagraficheFieldStatsResponse, { kind: "date" }> }) {
  const series = [
    {
      name: "Record",
      data: [
        { x: "Prima", y: stats.data.beforeCount },
        { x: "Uguali", y: stats.data.equalCount },
        { x: "Dopo", y: stats.data.afterCount },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <StatCard label="Totale visibili" value={stats.totalAll} />
        <StatCard label="Validi" value={stats.totalValid} />
        <StatCard label="Vuoti/invalidi" value={stats.missingCount} />
      </div>

      <div className="rounded-xl border border-stroke p-3 dark:border-dark-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-dark dark:text-white">Prima / Uguali / Dopo</div>
          <div className="text-xs text-dark/60 dark:text-white/60">Pivot: {formatDateLike(stats.data.pivotIso)}</div>
        </div>

        <ApexBarChart height={280} series={series} colors={["#5750F1"]} options={{ legend: { show: false } }} />
      </div>
    </div>
  );
}

function NumberCharts({ stats }: { stats: Extract<AnagraficheFieldStatsResponse, { kind: "number" }> }) {
  const series = [
    {
      name: "Record",
      data: [
        { x: "Più piccoli", y: stats.data.lessCount },
        { x: "Uguali", y: stats.data.equalCount },
        { x: "Più grandi", y: stats.data.greaterCount },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <StatCard label="Totale visibili" value={stats.totalAll} />
        <StatCard label="Validi" value={stats.totalValid} />
        <StatCard label="Vuoti/invalidi" value={stats.missingCount} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StatCard label="Pivot" value={stats.data.pivot} />
        <StatCard label="Media" value={stats.data.avg ?? "—"} />
        <div className="rounded-xl border border-stroke p-3 dark:border-dark-3">
          <div className="text-xs text-dark/60 dark:text-white/60">Hint</div>
          <div className="mt-0.5 text-sm font-semibold text-dark dark:text-white">breakdown &lt; / = / &gt;</div>
        </div>
      </div>

      <div className="rounded-xl border border-stroke p-3 dark:border-dark-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-dark dark:text-white">Distribuzione rispetto al pivot</div>
        </div>

        <ApexBarChart height={280} series={series} colors={["#0ABEF9"]} options={{ legend: { show: false } }} />
      </div>
    </div>
  );
}

export function AnagraficaFieldStatsModal(props: {
  open: boolean;
  onClose: () => void;

  type: string;
  fieldKey: string;
  fieldLabel: string;
  pivot: string | number;

  /** ✅ titolo record (preview) */
  recordTitle: string;
}) {
  const dispatch = useAppDispatch();

  const entry = useAppSelector((s) =>
    selectAnagraficheFieldStatsEntry(s, {
      type: props.type,
      fieldKey: props.fieldKey,
      pivot: props.pivot,
    }),
  );

  useEffect(() => {
    if (!props.open) return;
    if (entry?.status === "succeeded") return;

    dispatch(
      fetchAnagraficheFieldStats({
        type: props.type,
        fieldKey: props.fieldKey,
        pivot: props.pivot,
      }),
    );
  }, [props.open, props.type, props.fieldKey, props.pivot, dispatch, entry?.status]);

  const title = useMemo(() => {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span>Statistiche campo</span>
        <span className="text-dark/45 dark:text-white/45">·</span>
        <span className="font-bold">{props.recordTitle}</span>
      </span>
    );
  }, [props.recordTitle]);

  const subtitle = useMemo(() => {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span>Campo:</span>
        <span className="font-semibold text-dark dark:text-white">{props.fieldLabel}</span>
        <span className="text-dark/45 dark:text-white/45">·</span>
        <span className="text-xs text-dark/60 dark:text-white/60">{props.type}</span>
      </span>
    );
  }, [props.fieldLabel, props.type]);

  return (
    <FloatingModal
      open={props.open}
      onClose={props.onClose}
      title={title}
      subtitle={subtitle}
      maxWidthClassName="max-w-5xl"
      glow
      transitionMs={200}
    >
      {entry?.status === "loading" && (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded bg-gray-2 dark:bg-dark-2" />
          <div className="h-10 animate-pulse rounded bg-gray-2 dark:bg-dark-2" />
          <div className="h-10 animate-pulse rounded bg-gray-2 dark:bg-dark-2" />
        </div>
      )}

      {entry?.status === "failed" && (
        <div className="rounded-xl border border-rose-300 bg-rose-500/[0.06] p-3 text-sm text-rose-700 dark:border-rose-400/40 dark:text-rose-200">
          Errore: {entry.error || "Errore"}
        </div>
      )}

      {entry?.status === "succeeded" && entry.data && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <KindBadge kind={entry.data.kind} />

            <div className="text-xs text-dark/55 dark:text-white/55">
              Pivot:{" "}
              <span className="font-semibold text-dark dark:text-white">
                {entry.data.kind === "date"
                  ? formatDateLike(entry.data.data.pivotIso)
                  : entry.data.kind === "number"
                    ? entry.data.data.pivot
                    : entry.data.data.myValue}
              </span>
            </div>
          </div>

          {entry.data.kind === "select" ? (
            <SelectCharts stats={entry.data} />
          ) : entry.data.kind === "date" ? (
            <DateCharts stats={entry.data} />
          ) : (
            <NumberCharts stats={entry.data} />
          )}
        </div>
      )}

      {!entry && <div className="text-sm text-dark/60 dark:text-white/60">Pronto.</div>}
    </FloatingModal>
  );
}
