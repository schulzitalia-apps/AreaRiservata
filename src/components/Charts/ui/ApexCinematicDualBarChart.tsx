"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { cn } from "@/server-utils/lib/utils";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type CinematicBarSeries = {
  name: string;
  data: number[];
};

type Props = {
  className?: string;
  height?: number;

  categories: string[];
  series: CinematicBarSeries[];

  /** 2 colori, ordine=serie (Ricavi, Spese) */
  colors?: string[];

  /** legenda (di default true su multi-series) */
  showLegend?: boolean;

  /** formatter tooltip e y-axis */
  valueFormatter?: (n: number) => string;

  /** glow “cinema” */
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

function seriesColorStops(c: string) {
  // “cinema”: top più brillante, base più densa, bottom più scuro/trasparente
  return [
    { offset: 0, color: hexToRgba(c, 1), opacity: 1 },
    { offset: 38, color: hexToRgba(c, 0.95), opacity: 0.95 },
    { offset: 72, color: hexToRgba(c, 0.70), opacity: 0.85 },
    { offset: 100, color: hexToRgba(c, 0.25), opacity: 0.25 },
  ];
}

export function ApexCinematicDualBarChart({
                                            className,
                                            height = 360,
                                            categories,
                                            series,
                                            colors = ["#22C55E", "#EF4444"],
                                            showLegend = true,
                                            glow = true,
                                            valueFormatter = (n) => String(n),
                                            options,
                                          }: Props) {
  const a = colors[0] ?? "#22C55E";
  const b = colors[1] ?? "#EF4444";

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
        animations: {
          enabled: true,
          speed: 850,
          animateGradually: { enabled: true, delay: 80 },
          dynamicAnimation: { enabled: true, speed: 900 },
        },
        dropShadow: {
          enabled: true,
          top: 14,
          left: 0,
          blur: 22,
          opacity: 0.22,
          color: a,
        },
      },
      theme: { mode: "dark" },

      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "46%",
          borderRadius: 12,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
        },
      },

      dataLabels: { enabled: false },

      stroke: {
        show: true,
        width: 1,
        colors: ["rgba(255,255,255,0.10)"], // edge “glass”
      },

      states: {
        hover: { filter: { type: "lighten"} },
        active: { filter: { type: "darken"} },
      },

      grid: {
        strokeDashArray: 7,
        borderColor: "rgba(255,255,255,0.10)",
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
        padding: { left: 10, right: 14, top: 8, bottom: 0 },
      },

      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          trim: true,
          style: { fontSize: "12px", fontWeight: 800, colors: "#9CA3AF" },
        },
        tooltip: { enabled: false },
      },

      yaxis: {
        labels: {
          style: { fontSize: "12px", fontWeight: 800, colors: "#9CA3AF" },
          formatter: (v) => valueFormatter(Math.round(Number(v))),
        },
      },

      legend: {
        show: showLegend && series.length > 1,
        position: "top",
        horizontalAlign: "left",
        fontFamily: "inherit",
        fontWeight: 900,
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
          shadeIntensity: 0.35,
          inverseColors: false,
          // per-serie: stop personalizzati (questa è la differenza “seria”)
          colorStops: colors.map((c) => seriesColorStops(c)),
        } as any,
      },
    } satisfies ApexOptions;
  }, [categories, colors, height, series.length, showLegend, valueFormatter]);

  return (
    <div className={cn("relative w-full", className)}>
      {/* glow layer (cinema) */}
      {glow ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl blur-3xl opacity-70"
          style={{
            background: `
              radial-gradient(circle at 22% 30%, ${hexToRgba(a, 0.22)} 0%, transparent 58%),
              radial-gradient(circle at 78% 35%, ${hexToRgba(b, 0.20)} 0%, transparent 60%),
              radial-gradient(circle at 50% 86%, ${hexToRgba("#FFFFFF", 0.06)} 0%, transparent 62%)
            `,
          }}
        />
      ) : null}

      {/* vignette / glass */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 55%)",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 40px 120px rgba(0,0,0,0.35)",
        }}
      />

      <div
        className="relative w-full"
        style={{
          filter: `drop-shadow(0 0 18px ${hexToRgba(a, 0.18)}) drop-shadow(0 0 24px ${hexToRgba(
            b,
            0.14,
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
