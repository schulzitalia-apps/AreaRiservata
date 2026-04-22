
"use client";

import React, { useEffect } from "react";
import clsx from "clsx";

function useLockBodyScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
}

export function SprintTimelineModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "max-w-3xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200]">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
        onClick={onClose}
        aria-label="Chiudi modal"
      />

      <div className="absolute inset-0 overflow-y-auto px-4 py-8 md:px-6">
        <div
          className={clsx(
            "mx-auto overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.35)] dark:border-dark-3 dark:bg-gray-dark",
            "w-full",
            maxWidth,
          )}
        >
          <div className="border-b border-stroke px-5 py-4 dark:border-dark-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/45">
                  Sprint timeline
                </div>
                <h2 className="mt-1 text-xl font-semibold text-dark dark:text-white">{title}</h2>
                {subtitle ? (
                  <p className="mt-1 text-sm text-dark/65 dark:text-white/65">{subtitle}</p>
                ) : null}
              </div>

              <button
                type="button"
                className="rounded-xl border border-stroke bg-white/70 px-3 py-2 text-sm text-dark hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/60 dark:text-white"
                onClick={onClose}
              >
                Chiudi
              </button>
            </div>
          </div>

          <div className="max-h-[74vh] overflow-y-auto px-5 py-5">{children}</div>

          {footer ? (
            <div className="border-t border-stroke px-5 py-4 dark:border-dark-3">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
