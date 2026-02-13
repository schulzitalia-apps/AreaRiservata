"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/server-utils/lib/utils";

export type FloatingPlacement = "top" | "bottom" | "left" | "right";

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  placement?: FloatingPlacement;
  offset?: number;
  shift?: number;
  className?: string;

  children: (ctx: { placement: FloatingPlacement }) => React.ReactNode;

  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

type Coords = { top: number; left: number; placement: FloatingPlacement };

export default function FloatingPortal({
                                         open,
                                         anchorRef,
                                         placement = "bottom",
                                         offset = 10,
                                         shift = 8,
                                         className,
                                         children,
                                         onMouseEnter,
                                         onMouseLeave,
                                       }: Props) {
  const popRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => setMounted(true), []);

  const compute = () => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;

    const ar = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const fitsBelow = ar.bottom + offset + pr.height + shift <= vh;
    const fitsAbove = ar.top - offset - pr.height - shift >= 0;
    const fitsRight = ar.right + offset + pr.width + shift <= vw;
    const fitsLeft = ar.left - offset - pr.width - shift >= 0;

    let finalPlacement: FloatingPlacement = placement;

    if (placement === "bottom" && !fitsBelow && fitsAbove) finalPlacement = "top";
    if (placement === "top" && !fitsAbove && fitsBelow) finalPlacement = "bottom";
    if (placement === "right" && !fitsRight && fitsLeft) finalPlacement = "left";
    if (placement === "left" && !fitsLeft && fitsRight) finalPlacement = "right";

    let top = 0;
    let left = 0;

    const centerX = ar.left + ar.width / 2;
    const centerY = ar.top + ar.height / 2;

    if (finalPlacement === "bottom") {
      top = ar.bottom + offset;
      left = centerX - pr.width / 2;
    } else if (finalPlacement === "top") {
      top = ar.top - offset - pr.height;
      left = centerX - pr.width / 2;
    } else if (finalPlacement === "right") {
      top = centerY - pr.height / 2;
      left = ar.right + offset;
    } else {
      top = centerY - pr.height / 2;
      left = ar.left - offset - pr.width;
    }

    left = Math.max(shift, Math.min(vw - shift - pr.width, left));
    top = Math.max(shift, Math.min(vh - shift - pr.height, top));

    setCoords({ top, left, placement: finalPlacement });
  };

  useLayoutEffect(() => {
    if (!open) return;
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;

    let raf = 0;
    const onAnyScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => compute());
    };

    window.addEventListener("resize", onAnyScrollOrResize, { passive: true });
    window.addEventListener("scroll", onAnyScrollOrResize, { passive: true, capture: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onAnyScrollOrResize as any);
      window.removeEventListener("scroll", onAnyScrollOrResize as any, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={popRef}
      className={cn("fixed z-[1000]", className)}
      style={coords ? { top: coords.top, left: coords.left } : { top: -9999, left: -9999 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children({ placement: coords?.placement ?? placement })}
    </div>,
    document.body,
  );
}
