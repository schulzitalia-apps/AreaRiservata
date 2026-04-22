"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { cn } from "@/server-utils/lib/utils";
import { compactFormat } from "@/server-utils/lib/format-number";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type DonutDatum = { label: string; value: number };

type Props = {
  className?: string;
  height?: number;
  data: DonutDatum[];
  title?: string;
  valueFormatter?: (value: number) => string;
  colors?: string[];
  options?: ApexOptions;
  showLegend?: boolean;
  donutSize?: string;
  glow?: boolean;
  centerValue?: number;
};

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0);
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "").trim();
  const isShort = /^[0-9a-f]{3}$/i.test(normalized);
  const isLong = /^[0-9a-f]{6}$/i.test(normalized);

  if (!isShort && !isLong) return `rgba(255,255,255,${alpha})`;

  const full = isShort
    ? normalized
        .split("")
        .map((chunk) => chunk + chunk)
        .join("")
    : normalized;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  return `rgba(${r},${g},${b},${alpha})`;
}

export function ApexDonutChart({
  className,
  height = 380,
  data,
  title = "Totale",
  valueFormatter = (value) => compactFormat(value),
  colors = ["#5750F1", "#0ABEF9", "#5475E5", "#8099EC", "#ADBCF2", "#7C5CFF"],
  options,
  showLegend = false,
  donutSize = "84%",
  glow = true,
  centerValue,
}: Props) {
  const labels = useMemo(() => data.map((item) => item.label), [data]);
  const series = useMemo(() => data.map((item) => item.value), [data]);
  const legendItems = useMemo(
    () =>
      data.map((item, index) => ({
        color: colors[index] ?? colors[index % Math.max(colors.length, 1)] ?? "#94A3B8",
        label: item.label,
        value: item.value,
      })),
    [colors, data],
  );

  const total = useMemo(() => Math.max(0, Math.round(centerValue ?? sum(series))), [centerValue, series]);
  const glowA = colors[0] ?? "#5750F1";
  const glowB = colors[1] ?? "#0ABEF9";

  const base: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "inherit",
      background: "transparent",
      foreColor: "#E5E7EB",
      parentHeightOffset: 0,
      toolbar: { show: false },
      animations: {
        enabled: true,
        speed: 720,
        animateGradually: { enabled: true, delay: 80 },
        dynamicAnimation: { enabled: true, speed: 860 },
      },
    },
    theme: { mode: "dark" },
    colors,
    labels,
    dataLabels: { enabled: false },
    stroke: {
      width: 2,
      colors: ["rgba(0,0,0,0.55)"],
    },
    states: {
      hover: { filter: { type: "lighten" } },
      active: { filter: { type: "none" } },
    },
    legend: { show: false },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: donutSize,
          background: "transparent",
          labels: { show: false },
        },
      },
    },
    tooltip: {
      theme: "dark",
      y: { formatter: (value) => valueFormatter(Number(value)) },
    },
    grid: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
  };

  return (
    <div className={cn("relative z-20 w-full max-w-full overflow-hidden md:overflow-visible", className)}>
      {glow ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl blur-2xl opacity-60"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${hexToRgba(glowA, 0.28)} 0%, transparent 55%), radial-gradient(circle at 70% 65%, ${hexToRgba(glowB, 0.22)} 0%, transparent 60%)`,
          }}
        />
      ) : null}

      <div
        className="relative z-20 w-full max-w-full overflow-hidden md:overflow-visible [&_.apexcharts-canvas]:!max-w-full [&_.apexcharts-svg]:!max-w-full [&_.apexcharts-tooltip]:z-[90]"
        style={{ filter: `drop-shadow(0 0 18px ${hexToRgba(glowA, 0.28)}) drop-shadow(0 0 26px ${hexToRgba(glowB, 0.18)})` }}
      >
        <Chart options={{ ...base, ...(options ?? {}) }} series={series} type="donut" height={height} width="100%" />

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-[11px] font-extrabold tracking-wide text-gray-400">{title.toUpperCase()}</div>
            <div className="mt-1 text-3xl font-black text-white sm:text-[34px]">{valueFormatter(total)}</div>
          </div>
        </div>
      </div>

      {showLegend ? (
        <div className="mt-4 grid grid-cols-1 gap-2 px-2 text-xs font-semibold text-white/80 sm:flex sm:flex-wrap sm:items-start sm:justify-center sm:gap-x-4 sm:gap-y-2">
          {legendItems.map((item) => (
            <div
              key={`${item.label}-${item.color}`}
              className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-1"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
              <span className="text-white/55">-</span>
              <span className="shrink-0 text-white">{valueFormatter(item.value)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
