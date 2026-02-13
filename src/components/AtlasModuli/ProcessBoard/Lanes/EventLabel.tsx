"use client";

import { cn } from "@/server-utils/lib/utils";
import type { WhiteboardEventVM } from "../types";

type Props = {
  event: WhiteboardEventVM;
  className?: string;
};

function fmtFull(iso: string) {
  const d = new Date(iso);
  const dd = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const tt = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${dd} • ${tt}`;
}

function fmtDuration(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return null;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  const ms = b - a;
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

export default function EventLabel({ event, className }: Props) {
  const start = event.start ? fmtFull(event.start) : "—";
  const end = event.end ? fmtFull(event.end) : "—";
  const dur = fmtDuration(event.start, event.end);

  return (
    <div className={cn("text-left", className)}>
      {/* header: info "extra" che nel box non ci stanno */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wide opacity-90">
            {event.typeLabel}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold opacity-70">
            slug: {event.typeSlug}
          </div>
        </div>

        <div className="shrink-0 rounded-full border border-white/15 bg-black/10 px-2 py-0.5 text-[10px] font-semibold dark:bg-white/5">
          id: {event.id}
        </div>
      </div>

      {/* dettagli utili */}
      <div className="mt-3 space-y-2 text-[12px]">
        <div className="rounded-xl border border-white/10 bg-black/10 p-2 dark:bg-white/5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-semibold opacity-70">Inizio</span>
            <span className="text-[11px] font-bold">{start}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-semibold opacity-70">Fine</span>
            <span className="text-[11px] font-bold">{end}</span>
          </div>

          {dur ? (
            <div className="mt-2 inline-flex rounded-full border border-white/15 bg-black/10 px-2 py-0.5 text-[10px] font-semibold dark:bg-white/5">
              durata: {dur}
            </div>
          ) : null}
        </div>

        {/* subtitle qui è ok: nel box è clampata */}
        {event.subtitle ? (
          <div className="text-[11px] opacity-85">
            <span className="font-semibold opacity-70">nota:</span> {event.subtitle}
          </div>
        ) : null}

        <div className="text-[10px] font-semibold opacity-60">
          Click per aprire l’evento in nuova scheda.
        </div>
      </div>
    </div>
  );
}
