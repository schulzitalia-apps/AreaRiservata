"use client";

import { cn } from "@/server-utils/lib/utils";
import type { InputHTMLAttributes, ReactNode } from "react";
import { AppField } from "./AppField";

export type AppInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  leadingSlot?: ReactNode;
  trailingSlot?: ReactNode;
  density?: "compact" | "comfortable";
};

export function AppInput({
  className,
  label,
  hint,
  error,
  leadingSlot,
  trailingSlot,
  density = "comfortable",
  required,
  ...props
}: AppInputProps) {
  return (
    <AppField label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        {leadingSlot ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark/45 dark:text-white/45">
            {leadingSlot}
          </div>
        ) : null}
        <input
          className={cn(
            "w-full rounded-xl border border-stroke bg-white text-sm text-dark outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-dark-3 dark:bg-gray-dark dark:text-white",
            density === "compact" ? "px-3 py-2" : "px-4 py-2.5",
            leadingSlot ? "pl-10" : "",
            trailingSlot ? "pr-10" : "",
            error
              ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/15 dark:border-red-400/50"
              : "",
            className,
          )}
          {...props}
        />
        {trailingSlot ? (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dark/45 dark:text-white/45">
            {trailingSlot}
          </div>
        ) : null}
      </div>
    </AppField>
  );
}
