"use client";

import { cn } from "@/server-utils/lib/utils";
import type { WhiteboardEventVM } from "../types";
import EventLabelHover from "./EventLabelHover";

type Props = {
  ev: WhiteboardEventVM;
  className?: string;
  pillClass: string; // stile fluo (palette.pillSolid)
};

function fmtShortDateTime(iso: string) {
  const d = new Date(iso);
  const dd = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  const tt = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${dd} • ${tt}`;
}

function openEventPopup(ev: WhiteboardEventVM) {
  if (typeof window === "undefined") return;
  const url = `/eventi/${ev.typeSlug}/${ev.id}`;
  const win = window.open(url, "_blank", "noopener,noreferrer,width=960,height=720");
  if (win) win.focus();
}

export default function EventNode({ ev, pillClass, className }: Props) {
  const when = ev.start ? fmtShortDateTime(ev.start) : "";
  const title = ev.title || "(evento senza titolo)";

  return (
    <EventLabelHover event={ev} placement="right" maxWidth="24rem" withConnector>
      <button
        type="button"
        onClick={() => openEventPopup(ev)}
        className={cn(
          "w-[170px] sm:w-[170px] md:w-[170px]",
          "rounded-2xl border px-3 py-3 text-left",
          "transition hover:shadow-xl",
          "shadow-[0_0_0_rgba(0,0,0,0)]",
          // ✅ testo esplicito per evitare bianco su chiaro
          "text-dark dark:text-white",
          pillClass,
          className,
        )}
      >
        {/* TOP: pill tipo sopra data (in colonna) */}
        <div className="flex flex-col items-start gap-1">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5",
              "text-[10px] font-extrabold uppercase tracking-wide",
              // ✅ light: leggibile su pill chiara
              "border-stroke bg-white text-dark",
              // ✅ dark: effetto glass come prima
              "dark:border-white/25 dark:bg-black/10 dark:text-white",
            )}
          >
            {ev.typeLabel}
          </span>

          {when ? (
            <span className="text-[11px] font-semibold text-dark/80 dark:text-white/90">
              {when}
            </span>
          ) : null}
        </div>

        {/* TITLE */}
        <div className="mt-2">
          <div className={cn("text-[13px] font-bold leading-snug", "line-clamp-2 break-words")}>
            {title}
          </div>

          {ev.subtitle ? (
            <div className="mt-1 line-clamp-1 break-words text-[11px] font-medium text-dark/80 dark:text-white/85">
              {ev.subtitle}
            </div>
          ) : null}
        </div>
      </button>
    </EventLabelHover>
  );
}
