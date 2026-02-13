"use client";

import { useMemo, useState } from "react";
import { cn } from "@/server-utils/lib/utils";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";

type RangeOpt = { label: string; days: number };

const DEFAULT_RANGE_OPTS: RangeOpt[] = [
  { label: "30 giorni", days: 30 },
  { label: "60 giorni", days: 60 },
  { label: "120 giorni", days: 120 },
  { label: "180 giorni", days: 180 },
  { label: "365 giorni", days: 365 },
];

type Props = {
  value: number;
  onChange: (days: number) => void;
  options?: RangeOpt[];
  className?: string;
};

export default function WindowDaysDropdown({
                                             value,
                                             onChange,
                                             options = DEFAULT_RANGE_OPTS,
                                             className,
                                           }: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    return options.find((o) => o.days === value)?.label ?? `${value} giorni`;
  }, [options, value]);

  return (
    <Dropdown isOpen={open} setIsOpen={setOpen}>
      <DropdownTrigger
        className={cn(
          "rounded-full border px-3 py-1 text-[11px] font-semibold",
          // ✅ colori espliciti (niente trasparenze, niente testo invisibile)
          "border-stroke bg-white text-dark hover:bg-gray",
          "dark:border-dark-3 dark:bg-dark-4 dark:text-white dark:hover:bg-dark-3",
          className,
        )}
      >
        {selectedLabel}
      </DropdownTrigger>

      <DropdownContent
        align="end"
        className={cn(
          // ✅ override w-full/min-w-full del DropdownContent
          "w-56 min-w-[14rem]",
          "z-[9999]",
          // ✅ background + testo coerenti col tema
          "rounded-2xl border border-stroke bg-white p-2 text-dark shadow-2xl",
          "dark:border-dark-3 dark:bg-dark-4 dark:text-white",
        )}
      >
        <div className="px-2 py-1.5 text-[11px] font-bold opacity-80">
          Intervallo
        </div>

        {/* ✅ contenitore scrollabile: NON tocchiamo Dropdown.tsx */}
        <div
          className={cn(
            "mt-1 overflow-auto rounded-xl",
            "max-h-[min(280px,calc(100vh-220px))]",
          )}
        >
          {options.map((o) => {
            const active = o.days === value;

            return (
              <button
                key={o.days}
                type="button"
                onClick={() => {
                  onChange(o.days);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3",
                  "rounded-lg px-2 py-2 text-left",
                  "text-[12px] font-semibold transition",
                  // ✅ hover coerente (no gray-1)
                  "hover:bg-gray dark:hover:bg-dark-3",
                  // ✅ stato attivo
                  active ? "text-primary" : "opacity-90",
                )}
              >
                <span>{o.label}</span>

                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border",
                    active
                      ? "border-primary bg-primary"
                      : "border-stroke dark:border-dark-3",
                  )}
                />
              </button>
            );
          })}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
