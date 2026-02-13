"use client";

import React from "react";
import { cn } from "@/server-utils/lib/utils";

export type PopoverPlacement = "top" | "bottom" | "left" | "right";

type PopoverProps = {
  children: React.ReactNode;
  className?: string;

  /** per eventuale connector (e coerenza con FloatingPortal) */
  placement?: PopoverPlacement;

  /** max width */
  maxWidth?: string;

  /** z-index wrapper (opzionale) */
  zIndexClassName?: string;

  /**
   * Se vuoi un “aggancio” elegante: una lineetta tratteggiata molto sottile.
   * Default: false (niente freccia e niente connector)
   */
  withConnector?: boolean;
};

export function Popover({
                          children,
                          className,
                          placement = "bottom",
                          maxWidth = "22rem",
                          zIndexClassName,
                          withConnector = false,
                        }: PopoverProps) {
  return (
    <div
      className={cn("relative", zIndexClassName)}
      style={{ maxWidth }}
      data-placement={placement}
    >
      {/* connector tratteggiato (opzionale, super sobrio) */}
      {withConnector && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute opacity-60 dark:opacity-70",
            placement === "bottom" &&
            "left-1/2 -top-3 h-3 -translate-x-1/2 border-l border-dashed border-stroke dark:border-dark-3",
            placement === "top" &&
            "left-1/2 -bottom-3 h-3 -translate-x-1/2 border-l border-dashed border-stroke dark:border-dark-3",
            placement === "right" &&
            "top-1/2 -left-3 w-3 -translate-y-1/2 border-t border-dashed border-stroke dark:border-dark-3",
            placement === "left" &&
            "top-1/2 -right-3 w-3 -translate-y-1/2 border-t border-dashed border-stroke dark:border-dark-3",
          )}
        />
      )}

      <div
        className={cn(
          // --- stile "satinato" come ContextMenuPanel ---
          "rounded-2xl border shadow-2xl",
          "border-stroke/80 dark:border-dark-3/80",
          "bg-white/96 backdrop-blur-md backdrop-saturate-150",
          "dark:bg-gray-900/88 dark:backdrop-blur-md dark:backdrop-saturate-150",
          "ring-1 ring-black/5 dark:ring-white/5",

          // testo più leggibile
          "text-sm leading-relaxed text-gray-900 dark:text-white",

          // padding “da tooltip”
          "p-4",

          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
