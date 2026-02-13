"use client";

import { cn } from "@/server-utils/lib/utils";
import type { CalendarEventVM } from "../types";

type Props = {
  event: CalendarEventVM;
  placement?: "top" | "bottom" | "left" | "right";
  maxWidth?: string;
  withArrow?: boolean;
  className?: string;
};

/* ------------------------------------------ */
/*   UTILITIES FORMATTING                     */
/* ------------------------------------------ */

function formatTimeLabel(ev: CalendarEventVM) {
  if (ev.allDay) return "Tutto il giorno";

  const s = new Date(ev.start);
  const e = new Date(ev.end);

  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  return `${s.toLocaleTimeString([], opts)} — ${e.toLocaleTimeString([], opts)}`;
}

function formatDateLabel(ev: CalendarEventVM) {
  const s = new Date(ev.start);
  const e = new Date(ev.end);

  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  const format = (d: Date) =>
    d.toLocaleDateString([], {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  // EVENTO DI UN SOLO GIORNO
  if (sameDay) return format(s);

  // MULTI-GIORNO
  return `${format(s)} → ${format(e)}`;
}

function visibilityLabel(role: string | null | undefined) {
  if (!role || role.trim() === "") return "Solo proprietario";
  return role;
}

function openEventPopup(ev: CalendarEventVM) {
  if (typeof window === "undefined") return;
  const url = `/eventi/${ev.typeSlug}/${ev.id}`;

  const win = window.open(
    url,
    "_blank",
    "noopener,noreferrer,width=960,height=720",
  );
  if (win) win.focus();
}

/* ------------------------------------------ */
/*   COMPONENTE PRINCIPALE                    */
/* ------------------------------------------ */

export default function EventLabel({
                                     event,
                                     placement = "bottom",
                                     maxWidth = "22rem",
                                     withArrow = true,
                                     className,
                                   }: Props) {
  const timeLabel = formatTimeLabel(event);
  const dateLabel = formatDateLabel(event);
  const visLabel = visibilityLabel(event.visibilityRole);

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEventPopup(event);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "relative cursor-pointer select-none rounded-xl p-4 text-sm leading-relaxed shadow-2xl",
        "border border-stroke bg-white text-black",
        "dark:border-dark-3 dark:bg-gray-900 dark:text-white",
        "transition hover:shadow-xl",
        className
      )}
      style={{ maxWidth }}
    >
      {/* ARROW */}
      {withArrow && (
        <span
          className={cn(
            "pointer-events-none absolute h-0 w-0 border-transparent",
            placement === "bottom" &&
            "left-1/2 -top-2 -translate-x-1/2 border-b-[10px] border-l-[10px] border-r-[10px] border-b-stroke dark:border-b-dark-3",
            placement === "top" &&
            "left-1/2 -bottom-2 -translate-x-1/2 border-t-[10px] border-l-[10px] border-r-[10px] border-t-stroke dark:border-t-dark-3",
          )}
        />
      )}

      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight break-words">
            {event.title}
          </div>

          {event.subtitle && (
            <div className="mt-1 text-[12px] text-gray-600 dark:text-gray-300">
              {event.subtitle}
            </div>
          )}
        </div>

        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
            !event.visibilityRole
              ? "bg-blue-600/15 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300"
              : "bg-green-600/15 text-green-700 dark:bg-green-600/20 dark:text-green-300"
          )}
        >
          {visLabel}
        </span>
      </div>

      {/* TEMPO */}
      <div className="mt-3 text-[13px] font-medium opacity-90">{timeLabel}</div>

      {/* DATE RANGE OR SINGLE DATE */}
      <div className="text-[12px] opacity-80">{dateLabel}</div>

      {/* NOTES */}
      {event.notes && (
        <div className="mt-3 whitespace-pre-wrap text-[13px] opacity-90">
          {event.notes.length > 300
            ? `${event.notes.slice(0, 300)}…`
            : event.notes}
        </div>
      )}
    </div>
  );
}
