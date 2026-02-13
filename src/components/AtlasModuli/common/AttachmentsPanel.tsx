"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { GlowButton } from "./GlowButton";
import { InfoPill } from "./InfoPill";

export interface AttachmentViewItem {
  id: string;
  title: string;
  href: string;
  category?: string | null;
  type?: string | null;
  uploadedAt?: string | null; // ISO string o simile
}

interface AttachmentsPanelProps {
  title?: ReactNode; // es. "Allegati Aula" / "Allegati"
  loading: boolean;
  items: AttachmentViewItem[];
  emptyMessage?: ReactNode; // default: "Nessun allegato"
  viewLabel?: string; // default: "View"
}

export function AttachmentsPanel({
                                   title = "Allegati",
                                   loading,
                                   items,
                                   emptyMessage = "Nessun allegato",
                                   viewLabel = "View",
                                 }: AttachmentsPanelProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, AttachmentViewItem[]>();
    for (const a of items) {
      const cat = a.category || "altro";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    const entries = [...map.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return entries.map(([cat, list]) => ({
      cat,
      items: list.sort((x, y) => x.title.localeCompare(y.title)),
    }));
  }, [items]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const next: Record<string, boolean> = {};
    grouped.forEach(({ cat }) => {
      next[cat] = true;
    });
    setOpen(next);
  }, [grouped]);

  const openPopup = (href: string) => {
    if (typeof window === "undefined") return;

    const width = 900;
    const height = 700;

    const left =
      window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top =
      window.screenY + Math.max(0, (window.outerHeight - height) / 2);

    window.open(
      href,
      "_blank",
      `noopener,noreferrer,width=${width},height=${height},left=${left},top=${top}`,
    );
  };

  return (
    <div className="rounded-2xl border border-stroke/60 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-dark-3 dark:bg-gray-dark/90">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-dark dark:text-white">
          {title}
        </h3>
        {!loading && items.length > 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">
            {items.length} allegati
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-gray-2 dark:bg-dark-2"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-dark/60 dark:text-white/60">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ cat, items }) => (
            <section
              key={cat}
              className="overflow-hidden rounded-xl border border-stroke/70 bg-white/70 shadow-xs dark:border-dark-3 dark:bg-dark-2/60"
            >
              {/* Header sezione SENZA pill */}
              <button
                type="button"
                onClick={() =>
                  setOpen((s) => ({
                    ...s,
                    [cat]: !s[cat],
                  }))
                }
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-2/40 dark:hover:bg-dark-2/60"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold capitalize text-dark dark:text-white">
                    {cat}
                  </span>
                  <span className="text-xs text-dark/60 dark:text-white/60">
                    ({items.length})
                  </span>
                </div>
                <span
                  className={`text-sm text-dark/70 transition-transform dark:text-white/70 ${
                    open[cat] ? "rotate-90" : ""
                  }`}
                  aria-hidden
                >
                  ▸
                </span>
              </button>

              {open[cat] && (
                <div className="border-t border-stroke/70 dark:border-dark-3">
                  {items.map((a, idx) => {
                    const uploadedAt = a.uploadedAt
                      ? new Date(a.uploadedAt).toLocaleDateString()
                      : null;

                    const rowCategory = a.category || cat;
                    const showDivider = idx !== items.length - 1;

                    return (
                      <div
                        key={a.id}
                        className={`grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm hover:bg-gray-2/40 dark:hover:bg-dark-2/60 ${
                          showDivider
                            ? "border-b border-stroke/60 dark:border-dark-3/70"
                            : ""
                        }`}
                      >
                        {/* Titolo, tipo e data (nessuna pill qui) */}
                        <div className="col-span-7 min-w-0 space-y-1">
                          {/* titolo: solo testo, non link */}
                          <div
                            className="truncate font-medium text-dark dark:text-white"
                            title={a.title}
                          >
                            {a.title}
                          </div>

                          {a.type && (
                            <div className="text-[11px] text-dark/70 dark:text-white/70">
                              {a.type}
                            </div>
                          )}

                          {uploadedAt && (
                            <div className="text-[11px] text-dark/60 dark:text-white/60">
                              Caricato il {uploadedAt}
                            </div>
                          )}
                        </div>

                        {/* Pill categoria (verde) */}
                        <div className="col-span-3 flex justify-start">
                          <InfoPill
                            tone="success"
                            className="truncate max-w-full capitalize"
                          >
                            {rowCategory}
                          </InfoPill>
                        </div>

                        {/* Azione view */}
                        <div className="col-span-2 flex justify-end text-xs">
                          <GlowButton
                            color="rose"
                            size="sm"
                            onClick={() => openPopup(a.href)}
                          >
                            {viewLabel}
                          </GlowButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
