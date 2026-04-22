"use client";

import { cn } from "@/server-utils/lib/utils";
import type { ReactNode } from "react";
import { AppPanel } from "./AppPanel";

export type AppToolbarProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  className?: string;
};

export function AppToolbar({
  title,
  description,
  meta,
  actions,
  filters,
  className,
}: AppToolbarProps) {
  return (
    <AppPanel className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-dark dark:text-white">
              {title}
            </h1>
            {meta}
          </div>
          {description ? (
            <p className="text-sm text-dark/60 dark:text-white/60">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {filters ? <div>{filters}</div> : null}
    </AppPanel>
  );
}
