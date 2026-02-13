"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import { GlowButton } from "@/components/AtlasModuli/common/GlowButton";

function useLockBodyScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export function RowHoverPreview({
                                  enabled = true,
                                  item,
                                  title,
                                  subtitle,
                                  moreInfoTitle,
                                  moreInfoKeys,
                                  renderValue,
                                  ownerName,
                                  updatedAt,
                                  rowContent,
                                }: {
  enabled?: boolean;
  item: AnagraficaPreview;
  title: string;
  subtitle?: string;
  moreInfoTitle: string;
  moreInfoKeys: FieldKey[];
  renderValue: (key: FieldKey) => string;
  ownerName?: string;
  updatedAt?: string;
  rowContent: React.ReactNode;
}) {
  // ✅ HOOKS SEMPRE QUI (mai fare return prima)
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  // se disabilitato: non aggancio eventi/click, e soprattutto non apro mai modal
  const isEnabled = !!enabled;

  useLockBodyScroll(isEnabled && open);

  const modalTitle = useMemo(() => title || moreInfoTitle, [title, moreInfoTitle]);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isEnabled) return;
    if (!open) return;
    closeBtnRef.current?.focus();
  }, [isEnabled, open]);

  useEffect(() => {
    if (!isEnabled) return;
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEnabled, open]);

  // ✅ se disabilitato, render semplice (ma DOPO gli hooks)
  if (!isEnabled) return <>{rowContent}</>;

  return (
    <>
      <div
        className={clsx(
          "relative",
          "transition-colors",
          hover ? "bg-primary/[0.03] dark:bg-primary/[0.06]" : "",
        )}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setHover(true)}
        onBlurCapture={() => setHover(false)}
      >
        {/* Click target */}
        <button
          type="button"
          className="absolute inset-0 z-[1] cursor-pointer"
          aria-label={`Apri dettagli ${modalTitle}`}
          onClick={() => setOpen(true)}
          style={{ background: "transparent" }}
        />

        {/* Content sopra il click layer */}
        <div className="relative z-[2]">{rowContent}</div>

        {/* Hover hint */}
        <div
          className={clsx(
            "pointer-events-none absolute right-3 top-3 z-[3] select-none",
            "rounded-full border border-primary/15 bg-white/60 px-3 py-1 text-[11px] text-dark/60 shadow-sm backdrop-blur",
            "dark:bg-gray-dark/50 dark:text-white/60 dark:border-white/10",
            hover ? "opacity-100" : "opacity-0",
            "transition-opacity",
          )}
          aria-hidden="true"
        >
          More info
        </div>
      </div>

      {/* Modal */}
      {open ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={modalTitle}
        >
          {/* backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            aria-label="Chiudi"
            onClick={() => setOpen(false)}
          />

          {/* panel */}
          <div
            className={clsx(
              "relative mx-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/20",
              "bg-white shadow-xl dark:bg-gray-dark",
            )}
          >
            <div className="border-b border-primary/10 px-5 py-4 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-dark dark:text-white">
                    {modalTitle}
                  </div>
                  {subtitle ? (
                    <div className="mt-1 text-sm text-dark/60 dark:text-white/60">
                      {subtitle}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <GlowButton
                    color="neutral"
                    size="sm"
                    className="px-3 py-2 text-[12px]"
                    onClick={() => setOpen(false)}
                  >
                    Chiudi
                  </GlowButton>
                </div>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {moreInfoKeys.map((k) => {
                  const value = renderValue(k);
                  return (
                    <div
                      key={String(k)}
                      className={clsx(
                        "rounded-xl border border-primary/10 bg-white/60 p-3",
                        "dark:bg-gray-dark/40 dark:border-white/10",
                      )}
                    >
                      <div className="text-[11px] font-medium text-dark/60 dark:text-white/60">
                        {String(k)}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-[13px] text-dark dark:text-white">
                        {value && value !== "—" ? value : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-1 text-[12px] text-dark/60 dark:text-white/60">
                {updatedAt ? <div>Aggiornato: {updatedAt}</div> : null}
                {ownerName ? <div>Proprietario: {ownerName}</div> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
