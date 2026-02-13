"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { cn } from "@/server-utils/lib/utils";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type XYPoint = { x: string; y: number };

export type BarSeries = {
  name: string;
  data: XYPoint[];
};

type Props = {
  className?: string;
  height?: number;

  series: BarSeries[];

  /** colori serie (ordine = serie) */
  colors?: string[];

  /** colori per punto (solo single-series di solito) */
  distributed?: boolean;

  /** stacked = necessario per l’effetto “acqua che riempie” */
  stacked?: boolean;

  /** di default false (evita caos) */
  showLegend?: boolean;

  /** formatter per tooltip e y-axis */
  valueFormatter?: (n: number) => string;

  /** glow come donut/gauge */
  glow?: boolean;

  options?: ApexOptions;
};

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

export function ApexBarChart({
                               className,
                               height = 320,
                               series,
                               colors = ["#0ABEF9", "rgba(255,255,255,0.10)"],
                               distributed = false,
                               stacked = false,
                               showLegend = false,
                               glow = true,
                               valueFormatter = (n) => String(n),
                               options,
                             }: Props) {
  const glowA = colors?.[0] ?? "#0ABEF9";
  const glowB = colors?.[1] ?? "#5750F1";

  const base: ApexOptions = useMemo(() => {
    return {
      colors,
      chart: {
        fontFamily: "inherit",
        type: "bar",
        height,
        background: "transparent",
        foreColor: "#E5E7EB",
        toolbar: { show: false },
        zoom: { enabled: false },
        stacked,
        stackType: "normal",
        animations: {
          enabled: true,
          speed: 750,
          animateGradually: { enabled: true, delay: 70 },
          dynamicAnimation: { enabled: true, speed: 900 },
        },
      },
      theme: { mode: "dark" },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "52%",
          borderRadius: 10,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
          distributed,
        },
      },
      dataLabels: { enabled: false },
      stroke: {
        show: false,
      },
      grid: {
        strokeDashArray: 6,
        borderColor: "rgba(255,255,255,0.10)",
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
        padding: { left: 6, right: 12, top: 6, bottom: 0 },
      },
      xaxis: {
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          trim: true,
          style: { fontSize: "12px", fontWeight: 700, colors: "#9CA3AF" },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          style: { fontSize: "12px", fontWeight: 700, colors: "#9CA3AF" },
          formatter: (v) => valueFormatter(Math.round(Number(v))),
        },
      },
      legend: {
        show: showLegend && series.length > 1,
        position: "top",
        horizontalAlign: "left",
        fontFamily: "inherit",
        fontWeight: 800,
        fontSize: "12px",
        labels: { colors: "#E5E7EB" },
        markers: { size: 9, shape: "circle" },
      },
      tooltip: {
        theme: "dark",
        x: { show: true },
        y: { formatter: (v) => valueFormatter(Number(v)) },
      },
      fill: {
        opacity: 1,
        type: "gradient",
        gradient: {
          shade: "dark",
          type: "vertical",
          shadeIntensity: 0.25,
          gradientToColors: colors.map((c) => c),
          inverseColors: false,
          opacityFrom: 1,
          opacityTo: 1,
          stops: [0, 70, 100],
        },
      },
    } satisfies ApexOptions;
  }, [colors, distributed, height, series.length, showLegend, stacked, valueFormatter]);

  return (
    <div className={cn("relative w-full", className)}>
      {glow ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl blur-2xl opacity-60"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${hexToRgba(glowA, 0.22)} 0%, transparent 55%),
                         radial-gradient(circle at 75% 65%, ${hexToRgba(glowB, 0.16)} 0%, transparent 60%)`,
          }}
        />
      ) : null}

      <div
        className="relative w-full"
        style={{
          filter: `drop-shadow(0 0 18px ${hexToRgba(glowA, 0.18)}) drop-shadow(0 0 26px ${hexToRgba(
            glowB,
            0.12,
          )})`,
        }}
      >
        <Chart
          options={{ ...base, ...(options ?? {}) }}
          series={series as any}
          type="bar"
          height={height}
        />
      </div>
    </div>
  );
}
