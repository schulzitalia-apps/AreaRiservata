// src/components/AtlasModuli/common/FiltersBar.tsx
"use client";

export type FilterConfig =
  | {
  id: string;
  type: "text";
  label?: string;
  placeholder?: string;
  widthClassName?: string;
}
  | {
  id: string;
  type: "select";
  label?: string;
  placeholder?: string;
  widthClassName?: string;
  options: { value: string; label: string }[];
};

export type FiltersValue = Record<string, string>;

interface FiltersBarProps {
  filters: FilterConfig[];
  values: FiltersValue;
  onChange: (id: string, value: string) => void;

  /** className opzionale per il container */
  className?: string;
}

import { Select } from "@/components/ui/select";

export function FiltersBar({
                             filters,
                             values,
                             onChange,
                             className = "flex flex-wrap gap-2",
                           }: FiltersBarProps) {
  return (
    <div className={className}>
      {filters.map((f) => {
        const value = values[f.id] ?? "";

        const width =
          f.widthClassName || "w-40 sm:w-64 text-sm";

        if (f.type === "text") {
          return (
            <div key={f.id} className={width}>
              {f.label && (
                <div className="mb-1 text-xs text-dark/70 dark:text-white/70">
                  {f.label}
                </div>
              )}
              <input
                value={value}
                onChange={(e) => onChange(f.id, e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              />
            </div>
          );
        }

        if (f.type === "select") {
          return (
            <div key={f.id} className={width}>
              {f.label && (
                <div className="mb-1 text-xs text-dark/70 dark:text-white/70">
                  {f.label}
                </div>
              )}
              <Select
                value={value}
                onChange={(v) => onChange(f.id, v)}
                options={f.options}
                placeholder={f.placeholder}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
