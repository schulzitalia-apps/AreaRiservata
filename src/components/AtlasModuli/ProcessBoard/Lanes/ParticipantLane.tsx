"use client";

import { cn } from "@/server-utils/lib/utils";
import type { WhiteboardEventVM, WhiteboardParticipant } from "../types";
import { TYPE_COLOR_PALETTE } from "@/components/AtlasModuli/Calendario/color-palette";
import EventNode from "./EventNode";
import ArrowDown from "./ArrowDown";

type Props = {
  participant: WhiteboardParticipant;
  events: WhiteboardEventVM[];
  typeColorMap: Record<string, number>;
};

function msBetween(a: WhiteboardEventVM, b: WhiteboardEventVM) {
  const aEnd = a.end ?? a.start;
  const bStart = b.start;
  if (!aEnd || !bStart) return null;
  const ta = new Date(aEnd).getTime();
  const tb = new Date(bStart).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return tb - ta; // può essere negativo (overlap)
}

function fmtDelta(ms: number) {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);

  const totalMin = Math.round(abs / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin - days * 60 * 24 - hours * 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}g`);
  if (hours) parts.push(`${hours}h`);
  if (!days && !hours) parts.push(`${mins}m`);
  else if (mins) parts.push(`${mins}m`);

  if (!parts.length) parts.push("0m");
  return `${sign}${parts.join(" ")}`;
}

export default function ParticipantLane({ participant, events, typeColorMap }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        "border-emerald-400/70",
        // ✅ tema-safe: niente testo invisibile su chiaro
        "bg-white text-dark",
        "dark:bg-dark-4 dark:text-white",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{participant.displayName}</div>
          <div className="text-[12px] text-dark/70 dark:text-white/70">
            {participant.anagraficaType}
          </div>
        </div>

        <div
          className={cn(
            "ml-auto rounded-full border px-3 py-1 text-[11px] font-semibold",
            "border-emerald-400/70",
            // ✅ pill leggibile in entrambi i temi
            "bg-white text-dark",
            "dark:bg-dark-3 dark:text-white",
          )}
        >
          {events.length} eventi
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-[13px] text-dark/70 dark:text-white/70">
          Nessun evento per questo partecipante.
        </div>
      ) : (
        <div className={cn("flex flex-col items-center", "gap-3")}>
          {events.map((ev, i) => {
            const idx = typeColorMap[ev.typeSlug] ?? 0;
            const palette = TYPE_COLOR_PALETTE[idx % TYPE_COLOR_PALETTE.length];

            const next = i < events.length - 1 ? events[i + 1] : null;
            const deltaMs = next ? msBetween(ev, next) : null;

            const deltaPill =
              deltaMs === null
                ? null
                : deltaMs < 0
                  ? `overlap ${fmtDelta(deltaMs)}`
                  : fmtDelta(deltaMs);

            return (
              <div
                key={`${participant.key}:${ev.typeSlug}:${ev.id}:${i}`}
                className="flex flex-col items-center"
              >
                <EventNode ev={ev} pillClass={palette.pillSolid} />

                {i < events.length - 1 ? (
                  <div className="flex flex-col items-center">
                    {/* pill delta tempo */}
                    {deltaPill ? (
                      <div
                        className={cn(
                          "my-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide",
                          "border-emerald-300/40",
                          // ✅ light: niente glass scuro che sbianca il testo
                          "bg-white text-dark",
                          // ✅ dark: glass ok
                          "dark:bg-white/5 dark:text-white",
                        )}
                      >
                        {deltaPill}
                      </div>
                    ) : null}

                    <ArrowDown className="mt-0" h={34} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
