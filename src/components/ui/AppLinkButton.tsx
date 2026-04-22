"use client";

import Link from "next/link";
import { cn } from "@/server-utils/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const appLinkButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
  {
    variants: {
      variant: {
        solid: "",
        outline: "border bg-transparent",
        ghost: "border border-transparent bg-transparent",
      },
      tone: {
        primary: "",
        neutral: "",
        success: "",
        danger: "",
      },
      size: {
        sm: "rounded-lg px-3 py-2 text-xs",
        md: "rounded-xl px-4 py-2.5 text-sm",
      },
    },
    compoundVariants: [
      { variant: "solid", tone: "primary", className: "bg-primary text-white hover:opacity-90" },
      { variant: "solid", tone: "neutral", className: "bg-dark text-white dark:bg-white dark:text-dark" },
      { variant: "solid", tone: "success", className: "bg-emerald-500 text-white" },
      { variant: "solid", tone: "danger", className: "bg-red-500 text-white" },
      {
        variant: "outline",
        tone: "primary",
        className:
          "border-primary/35 text-primary hover:bg-primary/10 dark:border-primary/40 dark:hover:bg-primary/15",
      },
      {
        variant: "outline",
        tone: "neutral",
        className:
          "border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2",
      },
      {
        variant: "outline",
        tone: "success",
        className:
          "border-emerald-500/35 text-emerald-700 hover:bg-emerald-500/10 dark:border-emerald-400/40 dark:text-emerald-100 dark:hover:bg-emerald-400/15",
      },
      {
        variant: "outline",
        tone: "danger",
        className:
          "border-red-500/35 text-red-700 hover:bg-red-500/10 dark:border-red-400/40 dark:text-red-100 dark:hover:bg-red-400/15",
      },
      { variant: "ghost", tone: "primary", className: "text-primary hover:bg-primary/10 dark:hover:bg-primary/15" },
      { variant: "ghost", tone: "neutral", className: "text-dark hover:bg-gray-2 dark:text-white dark:hover:bg-dark-2" },
      {
        variant: "ghost",
        tone: "success",
        className:
          "text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-400/15",
      },
      {
        variant: "ghost",
        tone: "danger",
        className:
          "text-red-700 hover:bg-red-500/10 dark:text-red-100 dark:hover:bg-red-400/15",
      },
    ],
    defaultVariants: {
      variant: "solid",
      tone: "primary",
      size: "md",
    },
  },
);

export type AppLinkButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href" | "className"
> &
  VariantProps<typeof appLinkButtonVariants> & {
  href: string;
  children: ReactNode;
  className?: string;
};

export function AppLinkButton({
  href,
  children,
  variant,
  tone,
  size,
  className,
  ...props
}: AppLinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(appLinkButtonVariants({ variant, tone, size }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
