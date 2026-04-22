"use client";

import { cn } from "@/server-utils/lib/utils";
import type { ReactNode } from "react";

export type AppFieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function AppField({
  label,
  hint,
  error,
  required,
  className,
  children,
}: AppFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-dark dark:text-white">
            {label}
            {required ? <span className="ml-1 text-red-500">*</span> : null}
          </label>
          {hint && !error ? (
            <span className="text-xs text-dark/55 dark:text-white/55">
              {hint}
            </span>
          ) : null}
        </div>
      ) : null}

      {children}

      {error ? (
        <div className="text-xs text-red-600 dark:text-red-300">{error}</div>
      ) : hint && !label ? (
        <div className="text-xs text-dark/55 dark:text-white/55">{hint}</div>
      ) : null}
    </div>
  );
}
