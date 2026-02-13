"use client";

import { cn } from "@/server-utils/lib/utils";

export type CatKey = "all" | string;

export function CategoryTabsDyn(props: {
  value: CatKey;
  onChange: (v: CatKey) => void;
  items: { key: CatKey; label: string; color?: string }[];
}) {
  const { value, onChange, items } = props;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-extrabold transition",
              active
                ? "border-primary/35 bg-primary/10 text-primary"
                : "border-stroke bg-white/60 text-gray-700 hover:bg-white dark:border-dark-3 dark:bg-gray-dark/40 dark:text-white/80 dark:hover:bg-dark-2",
            )}
            title={it.label}
          >
            <span className="inline-flex items-center gap-2">
              {it.key !== "all" ? (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: it.color || "#5750F1" }}
                />
              ) : null}
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
