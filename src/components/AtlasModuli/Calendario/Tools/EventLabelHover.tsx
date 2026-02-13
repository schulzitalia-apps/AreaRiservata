"use client";

import React, { useMemo, useRef, useState } from "react";
import FloatingPortal from "./FloatingPortal";
import type { CalendarEventVM } from "../types";
import { Popover } from "@/components/ui/Popover";
import EventLabel from "./EventLabel";

type Placement = "top" | "bottom" | "left" | "right";

type Props = {
  event: CalendarEventVM;
  placement?: Placement;
  maxWidth?: string;
  className?: string;
  children: React.ReactNode;

  /** opzionale: lineetta tratteggiata */
  withConnector?: boolean;
};

export default function EventLabelHover({
                                          event,
                                          placement = "bottom",
                                          maxWidth = "22rem",
                                          children,
                                          className,
                                          withConnector = false,
                                        }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const openNow = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(true);
  };

  const closeSoon = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  const labelBody = useMemo(
    () => (
      // EventLabel usato come "contenuto": gli togliamo la sua card/arrow
      <EventLabel
        event={event}
        withArrow={false}
        className="p-0 shadow-none border-0 bg-transparent dark:bg-transparent"
      />
    ),
    [event],
  );

  return (
    <div
      ref={anchorRef}
      className={className}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      {children}

      <FloatingPortal
        open={open}
        anchorRef={anchorRef as any}
        placement={placement}
        offset={10}
        shift={10}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
      >
        {({ placement: finalPlacement }) => (
          <Popover
            placement={finalPlacement}
            maxWidth={maxWidth}
            withConnector={withConnector}
          >
            {labelBody}
          </Popover>
        )}
      </FloatingPortal>
    </div>
  );
}
