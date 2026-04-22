"use client";

import { cn } from "@/server-utils/lib/utils";

export type AppLoadingOverlayProps = {
  open: boolean;
  label?: string;
  className?: string;
};

export function AppLoadingOverlay({
  open,
  label = "Caricamento in corso...",
  className,
}: AppLoadingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/35 backdrop-blur-sm",
        className,
      )}
    >
      <div className="rounded-2xl border border-primary/30 bg-white/90 px-5 py-4 text-sm font-medium text-dark shadow-card dark:border-primary/35 dark:bg-gray-dark/90 dark:text-white">
        {label}
      </div>
    </div>
  );
}
