"use client";

import { cn } from "@/server-utils/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const appBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral:
          "border-stroke bg-gray-2 text-dark/75 dark:border-dark-3 dark:bg-dark-2 dark:text-white/75",
        primary:
          "border-primary/30 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/20 dark:text-white",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/20 dark:text-emerald-100",
        warning:
          "border-amber-400/40 bg-amber-400/15 text-amber-800 dark:border-amber-300/40 dark:bg-amber-300/20 dark:text-amber-100",
        danger:
          "border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-400/40 dark:bg-red-400/20 dark:text-red-100",
        info:
          "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:border-sky-400/40 dark:bg-sky-400/20 dark:text-sky-100",
      },
      emphasis: {
        subtle: "",
        solid: "border-transparent text-white",
        outline: "bg-transparent",
      },
      size: {
        sm: "px-2.5 py-1 text-[11px]",
        md: "px-3 py-1.5 text-xs",
      },
    },
    compoundVariants: [
      {
        tone: "primary",
        emphasis: "solid",
        className: "bg-primary",
      },
      {
        tone: "success",
        emphasis: "solid",
        className: "bg-emerald-500",
      },
      {
        tone: "warning",
        emphasis: "solid",
        className: "bg-amber-500 text-dark",
      },
      {
        tone: "danger",
        emphasis: "solid",
        className: "bg-red-500",
      },
      {
        tone: "info",
        emphasis: "solid",
        className: "bg-sky-500",
      },
      {
        tone: "neutral",
        emphasis: "solid",
        className: "bg-dark text-white dark:bg-white dark:text-dark",
      },
      {
        emphasis: "outline",
        className: "backdrop-blur-sm",
      },
    ],
    defaultVariants: {
      tone: "neutral",
      emphasis: "subtle",
      size: "md",
    },
  },
);

export type AppBadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof appBadgeVariants>;

export function AppBadge({
  className,
  tone,
  emphasis,
  size,
  ...props
}: AppBadgeProps) {
  return (
    <span
      className={cn(appBadgeVariants({ tone, emphasis, size }), className)}
      {...props}
    />
  );
}
