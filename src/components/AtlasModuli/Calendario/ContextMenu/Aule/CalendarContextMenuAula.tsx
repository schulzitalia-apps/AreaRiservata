"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EventoDef } from "@/config/eventi.registry";
import { ContextMenuPanel } from "@/components/ui/ContextMenuPanel";
import { cn } from "@/server-utils/lib/utils";

export type AulaContextMenuPayload = {
  kind: "day" | "event" | "hour";
  isoDate: string;
  hour?: number;
  eventId?: string;
  typeSlug?: string;
};

type Props = {
  x: number; // PAGE X
  y: number; // PAGE Y
  centered?: boolean;
  payload: AulaContextMenuPayload | null;
  availableTypes: EventoDef[]; // lo teniamo perché serve al MODALE, non più al menu
  onClose: () => void;

  /** crea nuovo evento (tipo lo scegli nel modale) */
  onCreateNewAula: () => void;

  /** elimina evento dal menu */
  onDeleteEvent: (eventId: string, typeSlug: string) => void;

  /** apre modal presenze */
  onEditPresenze: (eventId: string, typeSlug: string) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function contextParts(payload: AulaContextMenuPayload) {
  const d = new Date(payload.isoDate + "T00:00:00");

  const dayNum = d.toLocaleDateString(undefined, { day: "2-digit" });
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const monthYear = d.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  const time =
    payload.kind === "hour" ? `${pad2(payload.hour ?? 0)}:00` : null;

  return { dayNum, weekday, monthYear, time };
}

export default function CalendarContextMenuAula({
                                                  x,
                                                  y,
                                                  centered,
                                                  payload,
                                                  availableTypes,
                                                  onClose,
                                                  onCreateNewAula,
                                                  onDeleteEvent,
                                                  onEditPresenze,
                                                }: Props) {
  // ✅ HOOKS SEMPRE CHIAMATI (anche quando payload è null)
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<Record<string, any>>({});

  const isEvent = payload?.kind === "event";

  const header = useMemo(() => {
    // se payload è null ritorniamo valori safe
    return payload
      ? contextParts(payload)
      : { dayNum: "", weekday: "", monthYear: "", time: null };
  }, [payload]);

  const recompute = () => {
    if (typeof window === "undefined") return;

    if (centered) {
      setStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const el = menuRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    const w = el?.offsetWidth ?? 260;
    const h = el?.offsetHeight ?? 240;

    let left = x - window.scrollX;
    let top = y - window.scrollY;

    if (left + w > vw - margin) left = vw - margin - w;
    if (top + h > vh - margin) top = vh - margin - h;
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    setStyle({ top, left });
  };

  useLayoutEffect(() => {
    if (!payload) return; // ✅ ok: condizione *dentro* l’effetto
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, centered, payload]);

  useEffect(() => {
    if (!payload) return; // ✅ ok: condizione *dentro* l’effetto

    let raf = 0;
    const onAnyScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => recompute());
    };

    window.addEventListener("resize", onAnyScrollOrResize, { passive: true });
    window.addEventListener("scroll", onAnyScrollOrResize, {
      passive: true,
      capture: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onAnyScrollOrResize as any);
      window.removeEventListener("scroll", onAnyScrollOrResize as any, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, centered, payload]);

  // ✅ SOLO DOPO GLI HOOKS possiamo fare return
  if (!payload) return null;

  const createSuffix = payload.kind === "hour" ? "(in quest'ora)" : "(qui)";

  const handleViewEvent = () => {
    if (!isEvent || !payload.eventId || !payload.typeSlug) return;
    if (typeof window === "undefined") return;

    const url = `/eventi/${payload.typeSlug}/${payload.eventId}`;
    const win = window.open(
      url,
      "_blank",
      "noopener,noreferrer,width=360,height=520",
    );
    if (win) win.focus();
  };

  return (
    <div
      className="fixed inset-0 z-[999]"
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
      aria-hidden
    >
      <ContextMenuPanel
        ref={menuRef}
        className="absolute"
        style={style}
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        {/* HEADER */}
        <div className="px-2 pt-1 pb-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-semibold",
                "bg-black/6 text-gray-900 dark:bg-white/12 dark:text-white",
                "ring-1 ring-black/5 dark:ring-white/5",
              )}
            >
              {header.dayNum}
            </span>

            <div className="min-w-0 leading-tight">
              <div className="text-[12px] font-semibold text-gray-900 dark:text-white">
                {header.weekday} {header.monthYear}
                {header.time ? (
                  <span className="ml-2 rounded-full bg-black/6 px-2 py-0.5 text-[11px] font-semibold text-gray-900 dark:bg-white/12 dark:text-white">
                    {header.time}
                  </span>
                ) : null}
              </div>

              <div className="mt-0.5 text-[11px] opacity-70">
                {payload.kind === "event"
                  ? "Azioni sull’evento"
                  : payload.kind === "hour"
                    ? "Azioni su questa fascia oraria"
                    : "Azioni sul giorno"}
              </div>
            </div>

            {payload.kind === "event" && (
              <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                evento
              </span>
            )}
          </div>
        </div>

        <div className="my-1 border-t border-stroke/60 dark:border-dark-3/60" />

        {/* CREA (UNO SOLO) */}
        <button
          className={cn(
            "block w-full rounded-lg px-3 py-2 text-left text-sm transition",
            "hover:bg-black/5 dark:hover:bg-white/10",
          )}
          onClick={() => {
            onCreateNewAula();
            onClose();
          }}
          role="menuitem"
        >
          ➕ Crea nuovo evento{" "}
          <span className="text-xs opacity-70">{createSuffix}</span>
        </button>

        <div className="my-1 border-t border-stroke/60 dark:border-dark-3/60" />

        <button
          className={cn(
            "block w-full rounded-lg px-3 py-2 text-left transition",
            "hover:bg-black/5 dark:hover:bg-white/10",
            !isEvent &&
            "cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent",
          )}
          onClick={() => {
            if (!isEvent) return;
            handleViewEvent();
            onClose();
          }}
          role="menuitem"
        >
          👁️ Apri evento
        </button>

        {/* ELIMINA */}
        <button
          className={cn(
            "block w-full rounded-lg px-3 py-2 text-left transition",
            "hover:bg-red-500/10 dark:hover:bg-red-500/15",
            "text-red-700 dark:text-red-300",
            (!isEvent || !payload.eventId || !payload.typeSlug) &&
            "cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent",
          )}
          onClick={() => {
            if (!isEvent || !payload.eventId || !payload.typeSlug) return;
            onDeleteEvent(payload.eventId, payload.typeSlug);
            onClose();
          }}
          role="menuitem"
        >
          🗑 Elimina evento
        </button>

        {/* PRESENZE */}
        <button
          className={cn(
            "block w-full rounded-lg px-3 py-2 text-left transition",
            "hover:bg-black/5 dark:hover:bg-white/10",
            (!isEvent || !payload.eventId) &&
            "cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent",
          )}
          onClick={() => {
            if (!isEvent || !payload.eventId) return;
            onEditPresenze(payload.eventId, payload.typeSlug || "");
            onClose();
          }}
          role="menuitem"
        >
          ✅ Gestisci presenze
        </button>
      </ContextMenuPanel>
    </div>
  );
}
