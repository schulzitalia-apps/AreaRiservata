"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { cn } from "@/server-utils/lib/utils";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type XYPoint = { x: unknown; y: number };

export type AreaSeries = {
  name: string;
  data: XYPoint[];
};

type Props = {
  className?: string;
  height?: number;

  series: AreaSeries[];
  colors?: string[];

  options?: ApexOptions;
};

export function ApexAreaChart({
                                className,
                                height = 310,
                                series,
                                colors = ["#5750F1", "#0ABEF9"],
                                options,
                              }: Props) {
  const base: ApexOptions = {
    legend: { show: series.length > 1 },
    colors,
    chart: {
      height,
      type: "area",
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    fill: {
      gradient: { opacityFrom: 0.55, opacityTo: 0 },
    },
    stroke: {
      curve: "smooth",
      width: 3,
    },
    grid: {
      strokeDashArray: 5,
      yaxis: { lines: { show: true } },
    },
    dataLabels: { enabled: false },
    tooltip: { marker: { show: true } },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
  };

  return (
    <div className={cn("w-full", className)}>
      <Chart
        options={{ ...base, ...(options ?? {}) }}
        series={series as any}
        type="area"
        height={height}
      />
    </div>
  );
}
