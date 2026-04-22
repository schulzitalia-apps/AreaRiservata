"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ContextMenuPanel } from "@/components/ui/ContextMenuPanel";
import type {
  SprintTimelineLane,
  SprintTimelineMenuPayload,
} from "./SprintTimeline.types";
import {
  canDeleteCheckpoint,
  canCreateLaneNote,
  canManageCheckpoint,
  canManageTaskBlock,
  canConfigureValidation,
  type SprintTimelineViewer,
} from "./permissions";

function dateParts(isoDate?: string) {
  if (!isoDate) return { day: "", weekday: "", monthYear: "" };
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { day: "", weekday: "", monthYear: "" };
  return {
    day: d.toLocaleDateString("it-IT", { day: "2-digit" }),
    weekday: d.toLocaleDateString("it-IT", { weekday: "short" }),
    monthYear: d.toLocaleDateString("it-IT", { month: "short", year: "numeric" }),
  };
}

export default function SprintTimelineContextMenu({
                                                    x,
                                                    y,
                                                    payload,
                                                    lane,
                                                    onClose,
                                                    onCreateEvent,
                                                    onOpenEvent,
                                                    onDeleteEvent,
                                                    onConfigureValidation,
                                                    currentUserName,
                                                    currentUserId,
                                                  }: {
  x: number;
  y: number;
  payload: SprintTimelineMenuPayload | null;
  lane: SprintTimelineLane | null;
  onClose: () => void;
  onCreateEvent: (laneId: string, unitIndex: number) => void;
  onOpenEvent?: (laneId: string, eventId: string) => void;
  onDeleteEvent?: (laneId: string, eventId: string) => void;
  onConfigureValidation?: (laneId: string, eventId: string) => void;
  currentUserName?: string;
  currentUserId?: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);
  const viewer = useMemo<SprintTimelineViewer>(
    () => ({
      userId: currentUserId,
      userName: currentUserName,
    }),
    [currentUserId, currentUserName],
  );

  useEffect(() => setMounted(true), []);

  const header = useMemo(() => {
    return payload ? dateParts(payload.isoDate) : { day: "", weekday: "", monthYear: "" };
  }, [payload]);

  const selectedEvent = useMemo(() => {
    if (!payload || payload.kind !== "event" || !lane) return null;
    return lane.events.find((event) => event.id === payload.eventId) ?? null;
  }, [payload, lane]);

  const canCreateLaneNoteHere = useMemo(() => {
    if (!lane) return false;
    return canCreateLaneNote(lane, viewer);
  }, [lane, viewer]);

  const canCreateCheckpointLike = useMemo(() => {
    if (!lane) return false;
    return canManageCheckpoint(lane, viewer);
  }, [lane, viewer]);

  const canDeleteSelectedEvent = useMemo(() => {
    if (!payload || payload.kind !== "event" || !lane || !selectedEvent) return false;

    if (selectedEvent.kind === "note") return true;

    if (selectedEvent.kind === "checkpoint") {
      return canDeleteCheckpoint(lane, selectedEvent, viewer);
    }

    if (selectedEvent.kind === "task-block" || selectedEvent.kind === "block-update") {
      return canManageTaskBlock(lane, selectedEvent, viewer);
    }

    return false;
  }, [payload, lane, selectedEvent, viewer]);

  const canOpenEvent = !!(payload?.kind === "event" && onOpenEvent);
  const canDeleteEvent = !!(payload?.kind === "event" && onDeleteEvent && canDeleteSelectedEvent);
  const canConfigValidation = useMemo(() => {
    if (!lane || !selectedEvent || selectedEvent.kind !== "validation") return false;
    if (selectedEvent.validationState !== "requested") return false;
    if ((selectedEvent.validators ?? []).length > 0) return false;
    return canConfigureValidation(lane, viewer);
  }, [lane, selectedEvent, viewer]);

  const recompute = () => {
    if (typeof window === "undefined") return;
    const el = menuRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const w = el?.offsetWidth ?? 300;
    const h = el?.offsetHeight ?? 220;

    let left = x;
    let top = y;

    if (left + w > vw - margin) left = vw - margin - w;
    if (top + h > vh - margin) top = vh - margin - h;
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    setStyle({ top, left });
  };

  useLayoutEffect(() => {
    if (!payload || !mounted) return;
    recompute();
  }, [payload, x, y, mounted]);

  useEffect(() => {
    if (!payload) return;

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };

    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true, capture: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [payload, x, y]);

  if (!payload || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      onClick={onClose}
      onContextMenu={(event) => event.preventDefault()}
      aria-hidden
    >
      <ContextMenuPanel
        ref={menuRef}
        className="absolute w-[300px] overflow-hidden rounded-[22px] border border-white/10 bg-[#0b1220] text-white shadow-[0_24px_60px_rgba(2,6,23,0.60)]"
        style={style}
        onClick={(event) => event.stopPropagation()}
        role="menu"
      >
        <div className="bg-[radial-gradient(circle_at_0%_0%,rgba(14,165,233,0.22),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(168,85,247,0.18),transparent_28%)] px-3 pb-3 pt-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-white/12 bg-white/8 px-2 text-[12px] font-semibold text-white">
              {header.day || String(payload.unitIndex + 1).padStart(2, "0")}
            </span>

            <div className="min-w-0 leading-tight">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/42">
                {payload.kind === "event" ? "Evento" : "Timeline"}
              </div>
              <div className="mt-1 text-[14px] font-semibold text-white">
                {header.weekday || "giorno"} {header.monthYear}
              </div>
              <div className="mt-0.5 text-[11px] text-white/55">
                {payload.kind === "event" ? "Azioni centrate sul pallino" : "Azioni sul giorno"}
              </div>
            </div>
          </div>
        </div>

        <div className="my-1 border-t border-white/10" />

        {payload.kind === "day" ? (
          <>
            {canCreateLaneNoteHere || canCreateCheckpointLike ? (
              <button
                className="mx-2 mb-2 block w-[calc(100%-16px)] rounded-xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-white/8"
                onClick={() => {
                  onCreateEvent(payload.laneId, payload.unitIndex);
                  onClose();
                }}
                role="menuitem"
              >
                ➕ Nuovo evento qui
                <div className="mt-1 text-xs font-normal text-white/55">
                  Il modal aprirà note per tutti; checkpoint e blocchi solo per chi è autorizzato.
                </div>
              </button>
            ) : (
              <div className="mx-2 mb-2 rounded-xl border border-white/10 px-3 py-3 text-left text-sm text-white/65">
                Nessuna azione disponibile qui.
                <div className="mt-1 text-xs text-white/45">
                  Non hai permessi per aggiungere eventi su questo task.
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {canOpenEvent ? (
              <button
                className="mx-2 block w-[calc(100%-16px)] rounded-xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-white/8"
                onClick={() => {
                  onOpenEvent?.(payload.laneId, payload.eventId);
                  onClose();
                }}
                role="menuitem"
              >
                👁 Apri evento
                <div className="mt-1 text-xs font-normal text-white/55">
                  Focus event-first nel drawer.
                </div>
              </button>
            ) : null}

            {canConfigValidation ? (
              <button
                className="mx-2 mt-1 block w-[calc(100%-16px)] rounded-xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-white/8"
                onClick={() => {
                  onConfigureValidation?.(payload.laneId, payload.eventId);
                  onClose();
                }}
                role="menuitem"
              >
                ⚙️ Configura Validazione
                <div className="mt-1 text-xs font-normal text-white/55">
                  Scegli i validatori e aggiungi una nota.
                </div>
              </button>
            ) : null}

            {canDeleteEvent ? (
              <button
                className="mx-2 mb-2 mt-1 block w-[calc(100%-16px)] rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-300 transition hover:bg-red-500/12"
                onClick={() => {
                  onDeleteEvent?.(payload.laneId, payload.eventId);
                  onClose();
                }}
                role="menuitem"
              >
                🗑 Elimina evento
                <div className="mt-1 text-xs font-normal text-red-200/70">
                  Rimuove solo l’evento selezionato se permesso.
                </div>
              </button>
            ) : (
              <div className="mx-2 mb-2 mt-1 rounded-xl border border-white/10 px-3 py-3 text-left text-sm text-white/65">
                Nessuna azione distruttiva disponibile.
                <div className="mt-1 text-xs text-white/45">
                  Note, checkpoint, validazioni e blocchi possono essere eliminati solo se hai i permessi corretti.
                </div>
              </div>
            )}
          </>
        )}
      </ContextMenuPanel>
    </div>,
    document.body,
  );
}
