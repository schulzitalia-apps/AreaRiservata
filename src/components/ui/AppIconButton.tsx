"use client";

import { cn } from "@/server-utils/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const iconButtonVariants = cva(
  "inline-flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      tone: {
        neutral:
          "border border-stroke bg-white text-dark hover:bg-gray-2 dark:border-dark-3 dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2",
        primary:
          "border border-primary/35 bg-primary/10 text-primary hover:bg-primary/15",
        danger:
          "border border-red-500/35 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-100",
      },
      size: {
        sm: "h-8 w-8 rounded-lg text-sm",
        md: "h-10 w-10 rounded-xl text-base",
        lg: "h-12 w-12 rounded-xl text-lg",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
);

export type AppIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants> & {
    icon: ReactNode;
    srLabel: string;
  };

export function AppIconButton({
  className,
  tone,
  size,
  icon,
  srLabel,
  ...props
}: AppIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={srLabel}
      className={cn(iconButtonVariants({ tone, size }), className)}
      {...props}
    >
      {icon}
    </button>
  );
}
