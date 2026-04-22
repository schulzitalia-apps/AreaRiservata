"use client";

import type { ReactNode } from "react";
import { AppBadge } from "./AppBadge";

export type AppTagProps = {
  children: ReactNode;
  onRemove?: () => void;
};

export function AppTag({ children, onRemove }: AppTagProps) {
  return (
    <AppBadge tone="neutral" emphasis="outline" className="gap-2 px-3 py-1.5">
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full px-1 text-[10px] text-dark/60 hover:bg-gray-2 hover:text-dark dark:text-white/60 dark:hover:bg-dark-2 dark:hover:text-white"
        >
          x
        </button>
      ) : null}
    </AppBadge>
  );
}
