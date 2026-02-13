"use client";

import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom" | "left" | "right";

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  placement?: Placement;
  offset?: number;
  shift?: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;

  children: (args: { placement: Placement }) => React.ReactNode;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function FloatingPortal({
                                         open,
                                         anchorRef,
                                         placement = "bottom",
                                         offset = 10,
                                         shift = 10,
                                         onMouseEnter,
                                         onMouseLeave,
                                         children,
                                       }: Props) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placement: Placement }>({
    top: 0,
    left: 0,
    placement,
  });

  useEffect(() => setMounted(true), []);

  const update = () => {
    const el = anchorRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();

    let top = 0;
    let left = 0;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (placement === "bottom") {
      top = r.bottom + offset;
      left = r.left + r.width / 2;
    } else if (placement === "top") {
      top = r.top - offset;
      left = r.left + r.width / 2;
    } else if (placement === "right") {
      top = r.top + r.height / 2;
      left = r.right + offset;
    } else {
      top = r.top + r.height / 2;
      left = r.left - offset;
    }

    const safeLeft = clamp(left, shift, vw - shift);
    const safeTop = clamp(top, shift, vh - shift);

    setPos({ top: safeTop, left: safeLeft, placement });
  };

  useLayoutEffect(() => {
    if (!open) return;
    update();

    const onScroll = () => update();
    const onResize = () => update();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement, offset, shift]);

  const style = useMemo<React.CSSProperties>(() => {
    let transform = "translate(-50%, 0)";
    if (pos.placement === "top") transform = "translate(-50%, -100%)";
    if (pos.placement === "right") transform = "translate(0, -50%)";
    if (pos.placement === "left") transform = "translate(-100%, -50%)";

    return {
      position: "fixed",
      top: pos.top,
      left: pos.left,
      transform,
      zIndex: 9999,
      pointerEvents: "auto",
    };
  }, [pos]);

  if (!mounted || !open) return null;

  return createPortal(
    <div style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children({ placement: pos.placement })}
    </div>,
    document.body,
  );
}
