"use client";

import { cn } from "@/server-utils/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const appCardVariants = cva(
  "relative overflow-hidden border text-dark transition-colors dark:text-white",
  {
    variants: {
      surface: {
        default: "border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark",
        subtle:
          "border-stroke/70 bg-white/70 backdrop-blur-sm dark:border-dark-3/70 dark:bg-gray-dark/45",
        glass:
          "border-stroke/70 bg-white/80 backdrop-blur-md dark:border-dark-3/70 dark:bg-gray-dark/50",
        inverse:
          "border-dark bg-dark text-white dark:border-white/10 dark:bg-black",
      },
      elevation: {
        flat: "shadow-none",
        raised: "shadow-1 dark:shadow-card",
        floating: "shadow-[0_12px_32px_rgba(4,7,8,0.12)] dark:shadow-[0_24px_48px_rgba(0,0,0,0.45)]",
      },
      radius: {
        md: "rounded-lg",
        lg: "rounded-xl",
        xl: "rounded-2xl",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
      interactive: {
        true: "hover:border-primary/40 hover:shadow-[0_10px_30px_rgba(44,214,115,0.12)]",
        false: "",
      },
    },
    defaultVariants: {
      surface: "default",
      elevation: "raised",
      radius: "xl",
      padding: "md",
      interactive: false,
    },
  },
);

export type AppCardProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof appCardVariants>;

export function AppCard({
  className,
  surface,
  elevation,
  radius,
  padding,
  interactive,
  ...props
}: AppCardProps) {
  return (
    <div
      className={cn(
        appCardVariants({
          surface,
          elevation,
          radius,
          padding,
          interactive,
        }),
        className,
      )}
      {...props}
    />
  );
}
