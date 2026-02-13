import * as React from "react";
import { cn } from "@/server-utils/lib/utils";

export function KpiTile({
                          title,
                          value,
                          sub,
                          right,
                          icon,
                        }: {
  title: string;
  value: string;
  sub?: string;
  right?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-stroke bg-white p-5 shadow-1",
        "dark:border-dark-3 dark:bg-gray-dark dark:shadow-card",
        "dark:shadow-[0_0_0_1px_rgba(87,80,241,0.10),0_20px_60px_rgba(0,0,0,0.45)]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? (
              <span
                className={cn(
                  "relative inline-flex h-11 w-11 items-center justify-center rounded-2xl",
                  "border border-stroke bg-gray-50 text-dark",
                  "dark:border-dark-3 dark:bg-dark-2 dark:text-white",
                )}
              >
                <span className="pointer-events-none absolute inset-0 hidden dark:block rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(10,190,249,0.18)_0%,transparent_60%)]" />
                <span className="relative">{icon}</span>
              </span>
            ) : null}

            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-dark-6">
              {title}
            </div>
          </div>

          <div className="mt-2 truncate text-xl font-black text-dark dark:text-white">{value}</div>
          {sub ? (
            <div className="mt-1 truncate text-xs font-semibold text-gray-500 dark:text-dark-6">
              {sub}
            </div>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}
