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

  title?: string; // label centro donut
  valueFormatter?: (n: number) => string;

  colors?: string[];
  options?: ApexOptions;

  // ✅ new
  showLegend?: boolean; // default: false (evita overlap)
  donutSize?: string; // default: "84%"
  glow?: boolean; // default: true
  centerValue?: number; // default: somma delle serie
};

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "").trim();
  const is3 = /^[0-9a-f]{3}$/i.test(h);
  const is6 = /^[0-9a-f]{6}$/i.test(h);

  if (!is3 && !is6) return `rgba(255,255,255,${alpha})`;

  const full = is3
    ? h
      .split("")
      .map((c) => c + c)
      .join("")
    : h;

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
                                 valueFormatter = (n) => compactFormat(n),
                                 colors = ["#5750F1", "#0ABEF9", "#5475E5", "#8099EC", "#ADBCF2", "#7C5CFF"],
                                 options,
                                 showLegend = false,
                                 donutSize = "84%",
                                 glow = true,
                                 centerValue,
                               }: Props) {
  const labels = useMemo(() => data.map((d) => d.label), [data]);
  const series = useMemo(() => data.map((d) => d.value), [data]);

  const total = useMemo(() => {
    const computed = sum(series);
    return Math.max(0, Math.round(centerValue ?? computed));
  }, [centerValue, series]);

  const glowA = colors?.[0] ?? "#5750F1";
  const glowB = colors?.[1] ?? "#0ABEF9";

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
    legend: {
      show: showLegend,
      position: "bottom",
      itemMargin: { horizontal: 10, vertical: 6 },
      fontSize: "12px",
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: donutSize,
          background: "transparent",
          labels: { show: false }, // ✅ overlay custom, più affidabile su dark
        },
      },
    },
    tooltip: {
      theme: "dark",
      y: { formatter: (v) => valueFormatter(Number(v)) },
    },
    grid: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Glow backdrop */}
      {glow ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl blur-2xl opacity-60"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${hexToRgba(glowA, 0.28)} 0%, transparent 55%),
                         radial-gradient(circle at 70% 65%, ${hexToRgba(glowB, 0.22)} 0%, transparent 60%)`,
          }}
        />
      ) : null}

      <div
        className="relative w-full"
        style={{
          filter: `drop-shadow(0 0 18px ${hexToRgba(glowA, 0.28)}) drop-shadow(0 0 26px ${hexToRgba(
            glowB,
            0.18,
          )})`,
        }}
      >
        <Chart
          options={{ ...base, ...(options ?? {}) }}
          series={series}
          type="donut"
          height={height}
        />

        {/* ✅ Center overlay: Totale SEMPRE visibile (fix immy4) */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-[11px] font-extrabold tracking-wide text-gray-400">
              {title.toUpperCase()}
            </div>
            <div className="mt-1 text-3xl font-black text-white sm:text-[34px]">
              {valueFormatter(total)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
