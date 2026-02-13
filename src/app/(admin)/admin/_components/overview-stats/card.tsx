import { ArrowDownIcon, ArrowUpIcon } from "@/assets/icons";
import { cn } from "@/server-utils/lib/utils";
import type { JSX, SVGProps } from "react";

type PropsType = {
  label: string;
  value: string;
  growthRate: number;
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
};

export function OverviewStatCard({ label, value, growthRate, Icon }: PropsType) {
  const isDecreasing = growthRate < 0;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[16px] bg-white p-5 shadow-1",
        "transition-all duration-200",
        "hover:shadow-md hover:-translate-y-[1px]",
        "hover:ring-1 hover:ring-primary/15",
        "dark:bg-gray-dark dark:hover:ring-primary/25",
      )}
    >
      {/* barra “bookmark” */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 h-full w-[6px]",
          "bg-gradient-to-b from-red/80 via-red/40 to-transparent",
          "opacity-70 transition-opacity duration-200 group-hover:opacity-95",
        )}
      />

      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <Icon className="h-[52px] w-[52px]" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-dark-6">
            {label}
          </p>

          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="truncate text-[22px] font-bold leading-7 text-dark dark:text-white">
              {value}
            </p>

            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                isDecreasing
                  ? "bg-red/10 text-red dark:bg-red/15"
                  : "bg-green/10 text-green dark:bg-green/15",
              )}
            >
              <span>{growthRate}%</span>
              {isDecreasing ? (
                <ArrowDownIcon aria-hidden />
              ) : (
                <ArrowUpIcon aria-hidden />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
