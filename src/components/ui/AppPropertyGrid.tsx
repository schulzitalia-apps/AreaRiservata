"use client";

import type { ReactNode } from "react";
import { AppCard } from "./AppCard";

export type AppPropertyGridItem = {
  label: ReactNode;
  value: ReactNode;
  tone?: "default" | "primary";
};

export type AppPropertyGridProps = {
  items: AppPropertyGridItem[];
};

export function AppPropertyGrid({ items }: AppPropertyGridProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <AppCard
          key={`${index}`}
          surface="subtle"
          elevation="flat"
          className={item.tone === "primary" ? "border-primary/25" : ""}
        >
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-dark/55 dark:text-white/55">
            {item.label}
          </div>
          <div
            className={[
              "mt-1 text-sm",
              item.tone === "primary"
                ? "text-primary"
                : "text-dark dark:text-white",
            ].join(" ")}
          >
            {item.value}
          </div>
        </AppCard>
      ))}
    </div>
  );
}
