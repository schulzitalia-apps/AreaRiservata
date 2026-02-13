"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

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

const toneMap: Record<InfoPillTone, string> = {
  neutral:
    "bg-slate-100/80 text-slate-700 border-slate-300/50 dark:bg-white/5 dark:text-white/80 dark:border-white/10",

  primary:
    "bg-primary/10 text-primary border-primary/30 dark:bg-primary/20 dark:text-primary-100 dark:border-primary/40",

  secondary:
    "bg-gray-200/60 text-gray-800 border-gray-300 dark:bg-gray-700/40 dark:text-gray-100 dark:border-gray-500/50",

  success:
    "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-400/20 dark:text-emerald-100 dark:border-emerald-400/40",

  warning:
    "bg-amber-400/15 text-amber-700 border-amber-400/40 dark:bg-amber-300/20 dark:text-amber-100 dark:border-amber-300/40",

  danger:
    "bg-red-500/10 text-red-600 border-red-500/30 dark:bg-red-400/20 dark:text-red-100 dark:border-red-400/40",

  info:
    "bg-cyan-500/10 text-cyan-600 border-cyan-500/30 dark:bg-cyan-400/20 dark:text-cyan-100 dark:border-cyan-400/40",

  sky:
    "bg-sky-500/10 text-sky-600 border-sky-500/30 dark:bg-sky-400/20 dark:text-sky-100 dark:border-sky-400/40",

  violet:
    "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:bg-violet-400/20 dark:text-violet-100 dark:border-violet-400/40",

  rose:
    "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-400/20 dark:text-rose-100 dark:border-rose-400/40",
};

export function InfoPill({
                           children,
                           tone = "neutral",
                           className,
                         }: InfoPillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium",
        "backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-150",
        toneMap[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
