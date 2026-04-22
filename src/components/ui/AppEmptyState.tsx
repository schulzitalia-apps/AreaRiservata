"use client";

import type { ReactNode } from "react";
import { AppCard } from "./AppCard";

export type AppEmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function AppEmptyState({
  title,
  description,
  action,
}: AppEmptyStateProps) {
  return (
    <AppCard surface="subtle" elevation="flat" className="text-center">
      <div className="mx-auto max-w-xl space-y-3 py-8">
        <div className="text-lg font-semibold text-dark dark:text-white">
          {title}
        </div>
        {description ? (
          <p className="text-sm text-dark/60 dark:text-white/60">
            {description}
          </p>
        ) : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </AppCard>
  );
}
