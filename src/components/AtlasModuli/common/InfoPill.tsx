"use client";

import type { ReactNode } from "react";
import { AppBadge } from "@/components/ui";
import { cn } from "@/server-utils/lib/utils";

export type InfoPillTone =
  | "neutral"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "sky"
  | "violet"
  | "rose";

interface InfoPillProps {
  children: ReactNode;
  tone?: InfoPillTone;
  className?: string;
}

const toneClassMap: Record<InfoPillTone, string> = {
  neutral: "",
  primary: "",
  secondary:
    "border-slate-300/70 bg-slate-100/90 text-slate-700 dark:border-slate-500/40 dark:bg-slate-700/30 dark:text-slate-100",
  success: "",
  warning: "",
  danger: "",
  info:
    "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-400/20 dark:text-cyan-100",
  sky: "",
  violet:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:border-violet-400/40 dark:bg-violet-400/20 dark:text-violet-100",
  rose:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/20 dark:text-rose-100",
};

const baseToneMap: Record<InfoPillTone, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  neutral: "neutral",
  primary: "primary",
  secondary: "neutral",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  sky: "info",
  violet: "info",
  rose: "danger",
};

export function InfoPill({
  children,
  tone = "neutral",
  className,
}: InfoPillProps) {
  return (
    <AppBadge
      tone={baseToneMap[tone]}
      size="sm"
      className={cn(
        "backdrop-blur-sm shadow-sm transition-shadow duration-150 hover:shadow-md",
        toneClassMap[tone],
        className,
      )}
    >
      {children}
    </AppBadge>
  );
}
