"use client";

import { cn } from "@/server-utils/lib/utils";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { AppField } from "./AppField";

export type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

export function AppTextarea({
  className,
  label,
  hint,
  error,
  required,
  ...props
}: AppTextareaProps) {
  return (
    <AppField label={label} hint={hint} error={error} required={required}>
      <textarea
        className={cn(
          "min-h-[120px] w-full rounded-xl border border-stroke bg-white px-4 py-3 text-sm text-dark outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-dark-3 dark:bg-gray-dark dark:text-white",
          error
            ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/15 dark:border-red-400/50"
            : "",
          className,
        )}
        {...props}
      />
    </AppField>
  );
}
