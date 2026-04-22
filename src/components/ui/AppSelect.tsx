"use client";

import type { ReactNode } from "react";
import { AppField } from "./AppField";
import { Select } from "./select";

export type AppSelectOption = {
  value: string;
  label: string;
};

export type AppSelectProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: AppSelectOption[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export function AppSelect({
  className,
  label,
  hint,
  error,
  options,
  placeholder = "Seleziona...",
  required,
  value,
  onChange,
  disabled,
}: AppSelectProps) {
  return (
    <AppField label={label} hint={hint} error={error} required={required}>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        wrapperClassName={className}
        triggerClassName={[
          "min-h-[48px] rounded-[20px] border border-primary/75 bg-[#040a09] px-5 text-white",
          "shadow-[0_0_0_1px_rgba(44,214,115,0.12),0_0_24px_rgba(44,214,115,0.08)]",
          "hover:bg-[#07100e] focus-visible:border-primary focus-visible:ring-primary/20",
          "dark:border-stroke-dark dark:bg-[#040a09] dark:text-white dark:hover:bg-[#07100e]",
          error
            ? "border-red-400/70 focus-visible:border-red-400 focus-visible:ring-red-400/20"
            : "",
        ].join(" ")}
        menuClassName={[
          "overflow-hidden rounded-[22px] border border-primary/60 bg-[#5d5d5d] text-white",
          "shadow-[0_18px_40px_rgba(0,0,0,0.42),0_0_0_1px_rgba(44,214,115,0.18)]",
          "dark:border-stroke-dark dark:bg-[#5d5d5d]",
        ].join(" ")}
        optionClassName="px-5 py-2.5 text-white hover:bg-white/8 dark:text-white dark:hover:bg-white/8"
        selectedOptionClassName="bg-[#99c2f4] text-[#1f446b] hover:bg-[#99c2f4] dark:bg-[#99c2f4] dark:text-[#1f446b]"
        emptyClassName="px-5 py-3 text-white/55"
      />
    </AppField>
  );
}
