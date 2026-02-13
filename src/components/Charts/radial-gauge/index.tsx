"use client";

import { useMemo, useState } from "react";
import { cn } from "@/server-utils/lib/utils";
import { RadialGaugeChart, type GaugeSize } from "./RadialGaugeChart";
import {
  Dropdown,
  DropdownContent,
  DropdownClose,
  DropdownTrigger,
} from "@/components/ui/dropdown";

export type TimeframeOption<T extends string = string> = {
  key: T;
  label: string;
  subLabel?: string;
};

export type RadialGaugeData<T extends string = string> = Record<
  T,
  {
    value: number; // raw (può essere >100)
    subtitle?: string;
  }
>;

type Props<T extends string = string> = {
  className?: string;

  /** ✅ ora opzionale (così in pagina puoi NON duplicare l’header) */
  title?: string;
  subtitle?: string;

  options: TimeframeOption<T>[];
  data: RadialGaugeData<T>;

  defaultKey?: T;
  size?: GaugeSize;

  colorFrom?: string;
  colorTo?: string;

  /** se true, mostra header compatto (non il “mattone” che avevi in immy5) */
  showHeader?: boolean;
};

export function RadialGauge<T extends string = string>({
                                                         className,
                                                         title,
                                                         subtitle,
                                                         options,
                                                         data,
                                                         defaultKey,
                                                         size = "jumbo",
                                                         colorFrom,
                                                         colorTo,
                                                         showHeader = false,
                                                       }: Props<T>) {
  const initialKey = (defaultKey ?? options?.[0]?.key) as T;

  const [activeKey, setActiveKey] = useState<T>(initialKey);
  const [open, setOpen] = useState(false);

  const activeOption = useMemo(() => {
    return options.find((o) => o.key === activeKey) ?? options[0];
  }, [activeKey, options]);

  const activeData = data[activeOption.key];
  const rawValue = Number.isFinite(activeData?.value) ? (activeData.value as number) : 0;
  const headerSubtitle = activeData?.subtitle ?? subtitle;

  const showDropdown = options.length > 1;

  return (
    <div className={cn("w-full", className)}>
      {showHeader && (title || headerSubtitle || showDropdown) ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <div className="text-sm font-extrabold text-white">{title}</div>
            ) : null}
            {headerSubtitle ? (
              <div className="mt-0.5 text-xs font-semibold text-gray-400">
                {headerSubtitle}
              </div>
            ) : null}
          </div>

          {showDropdown ? (
            <Dropdown isOpen={open} setIsOpen={setOpen}>
              <DropdownTrigger
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border border-emerald-400/60 px-4 text-xs font-extrabold",
                  "text-white hover:border-emerald-400",
                )}
              >
                <span>{activeOption.label}</span>
                <span className="text-white/70">▾</span>
              </DropdownTrigger>

              <DropdownContent
                align="end"
                className={cn(
                  "w-44 overflow-hidden rounded-xl border border-emerald-400/30 bg-black/90 backdrop-blur",
                )}
              >
                <div className="py-1">
                  {options.map((opt) => {
                    const isActive = opt.key === activeKey;
                    return (
                      <DropdownClose key={opt.key}>
                        <button
                          type="button"
                          onClick={() => setActiveKey(opt.key)}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-sm",
                            "text-white/90 hover:bg-white/5",
                            isActive && "font-semibold",
                          )}
                        >
                          <span>{opt.label}</span>
                          {isActive ? <span className="text-emerald-300">●</span> : null}
                        </button>
                      </DropdownClose>
                    );
                  })}
                </div>
              </DropdownContent>
            </Dropdown>
          ) : null}
        </div>
      ) : null}

      <RadialGaugeChart
        value={rawValue}
        displayValue={rawValue}
        size={size}
        subLabel={activeOption.subLabel ?? activeOption.label}
        colorFrom={colorFrom}
        colorTo={colorTo}
        glow
      />
    </div>
  );
}
