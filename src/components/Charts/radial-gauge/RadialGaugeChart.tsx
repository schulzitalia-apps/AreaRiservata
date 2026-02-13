"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { cn } from "@/server-utils/lib/utils";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type GaugeSize = "medium" | "large" | "jumbo";

export type RadialGaugeChartProps = {
  /**
   * Valore raw (può essere > 100).
   * L'arco viene “cappato” a 100, ma il numero mostrato può restare > 100 (displayValue).
   */
  value: number;

  /** Se vuoi mostrare in centro un valore diverso (es: rawPercent) */
  displayValue?: number;

  size?: GaugeSize;
  subLabel?: string;
  className?: string;

  colorFrom?: string;
  colorTo?: string;

  glow?: boolean; // default true
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function sizeConfig(size: GaugeSize) {
  switch (size) {
    case "jumbo":
      return { height: 520, valueFontSize: "66px", subLabelMt: "-mt-7", trackMargin: 12, hollow: "70%" };
    case "large":
      return { height: 440, valueFontSize: "54px", subLabelMt: "-mt-6", trackMargin: 11, hollow: "70%" };
    default:
      return { height: 340, valueFontSize: "44px", subLabelMt: "-mt-5", trackMargin: 10, hollow: "72%" };
  }
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

export function RadialGaugeChart({
                                   value,
                                   displayValue,
                                   size = "jumbo",
                                   subLabel,
                                   className,
                                   colorFrom = "#5750F1",
                                   colorTo = "#0ABEF9",
                                   glow = true,
                                 }: RadialGaugeChartProps) {
  const raw = Number.isFinite(value) ? value : 0;
  const arcValue = clamp(raw, 0, 100); // ✅ arco sempre “safe”
  const shown = Number.isFinite(displayValue) ? (displayValue as number) : raw;

  const cfg = sizeConfig(size);

  const options: ApexOptions = {
    chart: {
      type: "radialBar",
      height: cfg.height,
      fontFamily: "inherit",
      sparkline: { enabled: true },
      background: "transparent",
      foreColor: "#E5E7EB",
      animations: {
        enabled: true,
        speed: 750,
        animateGradually: { enabled: true, delay: 60 },
        dynamicAnimation: { enabled: true, speed: 900 },
      },
    },
    theme: { mode: "dark" },
    colors: [colorFrom],
    plotOptions: {
      radialBar: {
        startAngle: -130,
        endAngle: 130,
        hollow: {
          size: cfg.hollow,
          background: "transparent",
          dropShadow: {
            enabled: true,
            top: 0,
            left: 0,
            blur: 14,
            opacity: 0.22,
          },
        },
        track: {
          background: "rgba(255,255,255,0.08)",
          strokeWidth: "100%",
          margin: cfg.trackMargin,
          dropShadow: {
            enabled: true,
            top: 0,
            left: 0,
            blur: 10,
            opacity: 0.15,
          },
        },
        dataLabels: {
          name: { show: false },
          value: {
            show: true,
            offsetY: 10,
            fontSize: cfg.valueFontSize,
            fontWeight: 900,
            color: "#FFFFFF",
            formatter: () => `${Math.round(shown)}%`, // ✅ può mostrare > 100
          },
        },
      },
    },
    stroke: { lineCap: "round", width: 8 },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "horizontal",
        shadeIntensity: 0.22,
        gradientToColors: [colorTo],
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 55, 100],
      },
    },
    tooltip: { enabled: false },
  };

  return (
    <div className={cn("relative grid place-items-center", className)}>
      {glow ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl blur-2xl opacity-60"
          style={{
            background: `radial-gradient(circle at 40% 35%, ${hexToRgba(colorFrom, 0.22)} 0%, transparent 55%),
                         radial-gradient(circle at 70% 70%, ${hexToRgba(colorTo, 0.16)} 0%, transparent 60%)`,
          }}
        />
      ) : null}

      <div
        className="relative w-full"
        style={{
          filter: `drop-shadow(0 0 20px ${hexToRgba(colorFrom, 0.22)}) drop-shadow(0 0 26px ${hexToRgba(
            colorTo,
            0.16,
          )})`,
        }}
      >
        <Chart options={options} series={[arcValue]} type="radialBar" height={cfg.height} />
      </div>

      {subLabel ? (
        <div className={cn(cfg.subLabelMt, "relative text-center")}>
          <div className="text-sm font-semibold text-gray-400">{subLabel}</div>
        </div>
      ) : null}
    </div>
  );
}
