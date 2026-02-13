"use client";

import React, { forwardRef } from "react";
import { cn } from "@/server-utils/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /** Larghezza minima (default coerente coi menu attuali) */
  minWidthClassName?: string; // es: "min-w-[240px]"
  /** Larghezza massima */
  maxWidthClassName?: string; // es: "max-w-[90vw]"
  /** Padding interno (default: p-1.5) */
  paddingClassName?: string;
};

export const ContextMenuPanel = forwardRef<HTMLDivElement, Props>(
  (
    {
      className,
      children,
      minWidthClassName = "min-w-[240px]",
      maxWidthClassName = "max-w-[90vw]",
      paddingClassName = "p-1.5",
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border shadow-2xl",
          // Bordo coerente
          "border-stroke/80 dark:border-dark-3/80",
          // Effetto satinato (come Modal overlay, ma sul pannello)
          "bg-white/92 backdrop-blur-md backdrop-saturate-150",
          "dark:bg-gray-900/82 dark:backdrop-blur-md dark:backdrop-saturate-150",
          // Un filo di ring per definizione
          "ring-1 ring-black/5 dark:ring-white/5",
          // Tipografia
          "text-sm text-gray-900 dark:text-white",
          minWidthClassName,
          maxWidthClassName,
          paddingClassName,
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

ContextMenuPanel.displayName = "ContextMenuPanel";
