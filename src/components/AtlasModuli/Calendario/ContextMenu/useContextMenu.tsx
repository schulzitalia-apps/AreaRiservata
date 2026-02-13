"use client";

import { useCallback, useEffect, useState } from "react";

export type MenuPayload =
  | { kind: "day"; isoDate: string }
  | { kind: "hour"; isoDate: string; hour: number }
  | { kind: "event"; isoDate: string; eventId: string; typeSlug: string };

type Pos = { pageX: number; pageY: number; centered: boolean };

function getPagePoint(e: any): { pageX: number; pageY: number; clientX: number; clientY: number } {
  const clientX = typeof e.clientX === "number" ? e.clientX : 0;
  const clientY = typeof e.clientY === "number" ? e.clientY : 0;

  // React MouseEvent ha pageX/pageY ma spesso non è in type, quindi any
  const pageX =
    typeof e.pageX === "number"
      ? e.pageX
      : clientX + (typeof window !== "undefined" ? window.scrollX : 0);

  const pageY =
    typeof e.pageY === "number"
      ? e.pageY
      : clientY + (typeof window !== "undefined" ? window.scrollY : 0);

  return { pageX, pageY, clientX, clientY };
}

export function useContextMenu() {
  const [menuVisible, setMenuVisible] = useState(false);

  // ora sono coordinate "PAGE" (document), non viewport
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [menuCentered, setMenuCentered] = useState(false);
  const [ctxPayload, setCtxPayload] = useState<MenuPayload | null>(null);

  // tick per forzare rerender e far “seguire” scroll/resize
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!menuVisible) return;

    let raf = 0;
    const bump = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTick((t) => t + 1));
    };

    window.addEventListener("resize", bump, { passive: true });
    window.addEventListener("scroll", bump, { passive: true, capture: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", bump as any);
      window.removeEventListener("scroll", bump as any, true);
    };
  }, [menuVisible]);

  const computePosition = (e: any): Pos => {
    if (typeof window === "undefined") {
      return { pageX: e.clientX + 8, pageY: e.clientY + 8, centered: false };
    }

    const { pageX, pageY, clientX, clientY } = getPagePoint(e);

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // mobile → centro il menu
    if (vw < 640) {
      return {
        pageX: window.scrollX + vw / 2,
        pageY: window.scrollY + vh / 2,
        centered: true,
      };
    }

    // desktop → vicino al click
    // clamp fine lo farà il componente menu misurando dimensioni reali
    return {
      pageX: pageX + 8,
      pageY: pageY + 8,
      centered: false,
    };
  };

  const openMenuDay = useCallback(
    (e: { preventDefault?: () => void; clientX: number; clientY: number }, isoDate: string) => {
      e.preventDefault?.();
      const pos = computePosition(e as any);
      setMenuVisible(true);
      setMenuPos({ x: pos.pageX, y: pos.pageY });
      setMenuCentered(pos.centered);
      setCtxPayload({ kind: "day", isoDate });
    },
    [],
  );

  const openMenuHour = useCallback(
    (e: { preventDefault?: () => void; clientX: number; clientY: number }, isoDate: string, hour: number) => {
      e.preventDefault?.();
      const pos = computePosition(e as any);
      setMenuVisible(true);
      setMenuPos({ x: pos.pageX, y: pos.pageY });
      setMenuCentered(pos.centered);
      setCtxPayload({ kind: "hour", isoDate, hour });
    },
    [],
  );

  const openMenuEvent = useCallback(
    (e: { preventDefault?: () => void; clientX: number; clientY: number }, isoDate: string, eventId: string, typeSlug: string) => {
      e.preventDefault?.();
      const pos = computePosition(e as any);
      setMenuVisible(true);
      setMenuPos({ x: pos.pageX, y: pos.pageY });
      setMenuCentered(pos.centered);
      setCtxPayload({ kind: "event", isoDate, eventId, typeSlug });
    },
    [],
  );

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
    setCtxPayload(null);
    setMenuCentered(false);
  }, []);

  return {
    menuVisible,
    menuPos, // x,y = PAGE coords
    menuCentered,
    ctxPayload,
    openMenuDay,
    openMenuHour,
    openMenuEvent,
    closeMenu,
  };
}
