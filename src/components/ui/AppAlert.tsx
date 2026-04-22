"use client";

import type { ReactNode } from "react";
import { AppCard } from "./AppCard";

export type AppAlertProps = {
  tone?: "success" | "warning" | "danger" | "info";
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

const toneStyles = {
  success:
    "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  warning:
    "border-amber-400/35 bg-amber-400/12 text-amber-900 dark:text-amber-100",
  danger:
    "border-red-500/35 bg-red-500/10 text-red-900 dark:text-red-100",
  info:
    "border-sky-500/35 bg-sky-500/10 text-sky-900 dark:text-sky-100",
} as const;

export function AppAlert({
  tone = "info",
  title,
  description,
  actions,
}: AppAlertProps) {
  return (
    <AppCard
      surface="subtle"
      elevation="flat"
      className={`space-y-3 border ${toneStyles[tone]}`}
    >
      <div className="text-sm font-semibold">{title}</div>
      {description ? <div className="text-sm opacity-80">{description}</div> : null}
      {actions ? <div>{actions}</div> : null}
    </AppCard>
  );
}
