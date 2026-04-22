"use client";

import type { ReactNode } from "react";

export type AppDescriptionListItem = {
  label: ReactNode;
  value: ReactNode;
};

export type AppDescriptionListProps = {
  items: AppDescriptionListItem[];
};

export function AppDescriptionList({ items }: AppDescriptionListProps) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => (
        <div
          key={`${index}`}
          className="rounded-2xl border border-stroke bg-white/70 px-4 py-3 dark:border-dark-3 dark:bg-gray-dark/40"
        >
          <dt className="text-xs font-medium uppercase tracking-[0.08em] text-dark/55 dark:text-white/55">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm text-dark dark:text-white">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
