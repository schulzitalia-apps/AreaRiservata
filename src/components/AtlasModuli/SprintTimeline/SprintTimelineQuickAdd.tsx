"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/server-utils/lib/utils";
import { ContextMenuPanel } from "@/components/ui/ContextMenuPanel";
import type { SprintQuickAddAction } from "./SprintTimeline.types";

export type SprintQuickAddItem = {
  key: SprintQuickAddAction;
  label: string;
  hint?: string;
};

type Props = {
  onAction: (action: SprintQuickAddAction) => void;
  items: SprintQuickAddItem[];
  label?: React.ReactNode;
  title?: string;
};

export function SprintTimelineQuickAdd({
                                         onAction,
                                         items,
                                         label = "+",
                                         title = "Aggiungi",
                                       }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  const recompute = () => {
    if (typeof window === "undefined") return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = panel?.offsetWidth ?? 288;
    const height = panel?.offsetHeight ?? 220;
    const margin = 8;

    let left = rect.right - width;
    let top = rect.bottom + 8;

    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
    if (left < margin) left = margin;
    if (top + height > window.innerHeight - margin) top = rect.top - height - 8;
    if (top < margin) top = margin;

    setStyle({ left, top });
  };

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    recompute();
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (event: MouseEvent) => {
      const node = event.target as Node;
      if (triggerRef.current?.contains(node)) return;
      if (panelRef.current?.contains(node)) return;
      setOpen(false);
    };

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const headerText = useMemo(() => title || "Aggiungi", [title]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex items-center justify-center rounded-xl border border-primary/20 bg-white/70 px-3 py-2 text-sm font-semibold text-dark shadow-sm backdrop-blur",
          "hover:border-primary/40 hover:bg-primary/10 dark:border-dark-3 dark:bg-gray-dark/50 dark:text-white dark:hover:bg-dark-2/70",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
      >
        {label}
      </button>

      {open && mounted
        ? createPortal(
          <div className="fixed inset-0 z-[9999]" aria-hidden>
            <ContextMenuPanel
              ref={panelRef}
              className={cn(
                "absolute w-72 rounded-[22px] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(0,224,168,0.08),transparent_34%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.08),transparent_28%),rgba(255,255,255,0.96)] text-dark shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl",
                "dark:border-dark-3 dark:bg-[radial-gradient(circle_at_top_left,rgba(0,224,168,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_28%),rgba(17,24,39,0.96)] dark:text-white dark:shadow-[0_24px_60px_rgba(2,6,23,0.52)]",
              )}
              style={style}
              role="menu"
            >
              <div className="px-3 pb-2 pt-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-dark/45 dark:text-white/50">
                  {headerText}
                </div>
              </div>

              <div className="my-1 border-t border-stroke/70 dark:border-white/10" />

              {items.map((item) => (
                <button
                  key={item.key}
                  className={cn(
                    "mx-2 mb-2 block w-[calc(100%-16px)] rounded-xl border border-transparent bg-white/55 px-3 py-3 text-left transition",
                    "hover:border-primary/12 hover:bg-primary/10 dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.06]",
                  )}
                  onClick={() => {
                    onAction(item.key);
                    setOpen(false);
                  }}
                  role="menuitem"
                >
                  <div className="text-sm font-semibold text-dark dark:text-white">{item.label}</div>
                  {item.hint ? (
                    <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">{item.hint}</div>
                  ) : null}
                </button>
              ))}
            </ContextMenuPanel>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}