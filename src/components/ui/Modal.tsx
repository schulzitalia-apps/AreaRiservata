"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/server-utils/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;

  title?: React.ReactNode;
  subtitle?: React.ReactNode;

  disableClose?: boolean;

  children: React.ReactNode;
  footer?: React.ReactNode;

  /** larghezza max del pannello */
  maxWidthClassName?: string;

  /** className extra sul pannello */
  className?: string;

  /** z-index wrapper */
  zIndexClassName?: string;

  /**
   * Offset top per non andare sotto headbar.
   * Default: usa CSS var --app-header-h oppure 72px.
   */
  topOffset?: string; // es: "72px" o "var(--app-header-h)"

  /**
   * Padding attorno al pannello dentro la boundary.
   * Default 16px.
   */
  viewportPadding?: number; // px
};

type Bounds = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function Modal({
                        open,
                        onClose,
                        title,
                        subtitle,
                        disableClose,
                        children,
                        footer,
                        maxWidthClassName = "max-w-3xl",
                        className,
                        zIndexClassName = "z-[999]",
                        topOffset = "var(--app-header-h, 72px)",
                        viewportPadding = 16,
                      }: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // fallback bounds = viewport (poi verranno ricalcolati)
  const [bounds, setBounds] = useState<Bounds>(() => ({
    top: 0,
    left: 0,
    right: typeof window !== "undefined" ? window.innerWidth : 0,
    bottom: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  const selectors = useMemo(
    () => [
      "[data-modal-boundary]", // opzionale: se presente è il migliore
      "main",
      '[role="main"]',
      "#app-content",
    ],
    [],
  );

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableClose) onClose();
    };
    window.addEventListener("keydown", onKey);

    // blocca scroll pagina sotto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, disableClose]);

  useEffect(() => {
    if (!open) return;

    let raf = 0;
    let ro: ResizeObserver | null = null;

    const findBoundaryEl = (): Element | null => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };

    const computeHeaderOffsetPx = (): number => {
      // converte topOffset (var(...) o px) in px reali usando un elemento dummy
      const dummy = document.createElement("div");
      dummy.style.position = "fixed";
      dummy.style.top = topOffset;
      dummy.style.left = "0";
      dummy.style.visibility = "hidden";
      dummy.style.pointerEvents = "none";
      document.body.appendChild(dummy);
      const px = dummy.getBoundingClientRect().top; // distanza dal top viewport
      document.body.removeChild(dummy);
      // se px è 0 e topOffset è var non risolta, fallback 72
      return px || 72;
    };

    const update = () => {
      const headerPx = computeHeaderOffsetPx();

      const el = findBoundaryEl();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // base: viewport intera
      let rect = { top: 0, left: 0, right: vw, bottom: vh };

      // se troviamo boundary, usiamo il suo rettangolo (in viewport coords)
      if (el) {
        const r = (el as HTMLElement).getBoundingClientRect();
        rect = {
          top: r.top,
          left: r.left,
          right: r.right,
          bottom: r.bottom,
        };
      }

      // regole: mai sotto header
      const safeTop = Math.max(rect.top, headerPx);

      // padding interno
      const pad = viewportPadding;

      const next: Bounds = {
        top: clamp(safeTop + pad, 0, vh),
        left: clamp(rect.left + pad, 0, vw),
        right: clamp(rect.right - pad, 0, vw),
        bottom: clamp(rect.bottom - pad, 0, vh),
      };

      // evita bounds invertiti
      if (next.right - next.left < 50) {
        next.left = pad;
        next.right = vw - pad;
      }
      if (next.bottom - next.top < 50) {
        next.top = Math.max(headerPx + pad, pad);
        next.bottom = vh - pad;
      }

      setBounds(next);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    // prima misura
    schedule();

    // resize / scroll (capture per prendere anche scroll su container)
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    // osserva cambi dimensione boundary se possibile
    const boundary = document.querySelector(selectors[0]) || document.querySelector(selectors[1]) || null;
    if (boundary && "ResizeObserver" in window) {
      ro = new ResizeObserver(() => schedule());
      ro.observe(boundary as Element);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      ro?.disconnect();
    };
  }, [open, selectors, topOffset, viewportPadding]);

  if (!open) return null;

  const width = Math.max(0, bounds.right - bounds.left);
  const height = Math.max(0, bounds.bottom - bounds.top);

  return (
    <div className={cn("fixed inset-0", zIndexClassName)}>
      {/* Overlay: copre SOLO la boundary (non tutto layout globale) */}
      <button
        type="button"
        aria-label="Chiudi"
        className={cn(
          "absolute",
          "bg-black/80 dark:bg-black/85",
          "backdrop-blur-sm backdrop-saturate-150",
        )}
        style={{
          top: bounds.top,
          left: bounds.left,
          width,
          height,
        }}
        onClick={() => {
          if (!disableClose) onClose();
        }}
      />

      {/* Layer contenuti dentro boundary */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: bounds.top,
          left: bounds.left,
          width,
          height,
          pointerEvents: "none", // così il click passa solo al pannello
        }}
      >
        {/* Pannello: centrato V + H nella boundary */}
        <div
          ref={panelRef}
          className={cn(
            "w-full",
            maxWidthClassName,
            "rounded-2xl border border-stroke bg-white shadow-1",
            "dark:border-dark-3 dark:bg-gray-dark dark:shadow-card",
            "flex flex-col overflow-hidden",
            "pointer-events-auto",
            className,
          )}
          style={{
            // non deve mai superare la boundary
            maxHeight: height,
          }}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : "Modal"}
          onClick={(e) => e.stopPropagation()}
        >
          {(title || subtitle) && (
            <div className="flex items-start justify-between gap-3 border-b border-stroke p-4 dark:border-dark-3">
              <div className="min-w-0">
                {title && (
                  <div className="text-base font-semibold text-dark dark:text-white">
                    {title}
                  </div>
                )}
                {subtitle && (
                  <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">
                    {subtitle}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!disableClose) onClose();
                }}
                disabled={!!disableClose}
                className="shrink-0 rounded-md border border-stroke px-2 py-1 text-xs font-semibold text-dark hover:bg-gray-2 disabled:opacity-60 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
              >
                Chiudi ✕
              </button>
            </div>
          )}

          {/* BODY scrollabile: quando contenuto supera maxHeight */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {children}
          </div>

          {footer && (
            <div className="border-t border-stroke p-4 dark:border-dark-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
