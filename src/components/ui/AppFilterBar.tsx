"use client";

import { AppInput } from "./AppInput";
import { AppSelect, type AppSelectOption } from "./AppSelect";

export type AppFilterConfig =
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
      options: AppSelectOption[];
    };

export type AppFilterBarProps = {
  filters: AppFilterConfig[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  className?: string;
};

export function AppFilterBar({
  filters,
  values,
  onChange,
  className = "flex flex-wrap gap-3",
}: AppFilterBarProps) {
  return (
    <div className={className}>
      {filters.map((filter) => {
        const width = filter.widthClassName || "w-full sm:w-64";
        const value = values[filter.id] ?? "";

        if (filter.type === "text") {
          return (
            <div key={filter.id} className={width}>
              <AppInput
                label={filter.label}
                value={value}
                placeholder={filter.placeholder}
                onChange={(event) => onChange(filter.id, event.target.value)}
                density="compact"
              />
            </div>
          );
        }

        return (
          <div key={filter.id} className={width}>
            <AppSelect
              label={filter.label}
              value={value}
              placeholder={filter.placeholder}
              options={filter.options}
              onChange={(nextValue) => onChange(filter.id, nextValue)}
            />
          </div>
        );
      })}
    </div>
  );
}
