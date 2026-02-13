"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import jsVectorMap from "jsvectormap";
import "@/design/vector-maps/ita-province"; // deve registrare "italy_province"

type Props = {
  /** Codice area selezionata (se serve solo per evidenziare esterno) */
  selectedRegion?: string;
  /** Callback quando l’utente clicca una area sulla mappa. */
  onRegionSelect?: (regionCode: string) => void;
  /** Classe opzionale per layout */
  className?: string;
};

export default function Map({ onRegionSelect, className }: Props) {
  const containerId = useMemo(
    () => `map-ita-${Math.random().toString(36).slice(2)}`,
    []
  );
  const mapRef = useRef<any>(null);

  /** Sposta la vista iniziale "in giù" con ampio margine e un piccolo zoom-out */
  const repositionDownWithMargin = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Centro Italia approx
    const baseLat = 41.8719;
    const baseLng = 12.5674;

    // conversione approssimativa px -> deltaLat (nudge “visivo”)
    const pxToLatShift = (px: number) => {
      // 1° lat ~ 111km; non serve precisione, solo un offset empirico fluido.
      // 24px ~ 0.02°, quindi 160px ~ 0.133°
      return (px / 24) * 0.02;
    };

    // Spingi più in basso (margine ampio). 160px ≈ ~0.13° lat (valore empirico).
    const latShift = pxToLatShift(160);

    try {
      // Niente logiche di fit: solo posizione iniziale più bassa + scale < 1 per vedere più spazio
      map.setFocus?.({
        lat: baseLat + latShift, // centro più a nord -> la mappa appare più in basso nel box
        lng: baseLng,
        scale: 0.9, // leggero zoom-out iniziale (puoi scendere fino a 0.4 grazie a zoomMin)
        animate: false,
      });
    } catch {
      // ignora eventuali errori sulle versioni che clampano lo scale
    }
  }, []);

  useEffect(() => {
    const map = new jsVectorMap({
      selector: `#${containerId}`,
      map: "italy_province",
      // controlli zoom
      zoomButtons: false,
      zoomOnScroll: true,
      zoomOnScrollSpeed: 1,
      zoomStep: 1.2,
      zoomMax: 20,
      // ⬇️ consenti zoom-out oltre la vista standard
      zoomMin: 0.4 as any, // (alcune versioni non tipizzano zoomMin, ma la prop funziona)
      regionStyle: {
        initial: {
          fill: "#C8D0D8",
          "fill-opacity": 1,
          stroke: "#0f172a",
          "stroke-opacity": 0.15,
          "stroke-width": 1,
        },
        hover: {
          fill: "#ef4444",
          "fill-opacity": 1,
          cursor: "pointer",
        },
        selected: {
          fill: "#ef4444",
        },
      },
      onRegionTooltipShow: function (_: any, tooltip: any) {
        tooltip.css({
          "font-size": "20px",
          "font-weight": "600",
          "background-color": "rgba(255, 0, 0, 0.30)",
        });
      },
      // Nessun ingrandimento al click: solo callback
      onRegionClick: (_: any, code: string) => {
        onRegionSelect?.(code);
      },
    });

    mapRef.current = map;

    // Nascondi eventuali <text> inseriti nel file SVG della mappa
    const container = document.getElementById(containerId);
    if (container) {
      const styleEl = document.createElement("style");
      styleEl.setAttribute("mock-hide-svg-text", "true");
      styleEl.innerHTML = `#${containerId} svg text { display: none !important; }`;
      container.appendChild(styleEl);
    }

    // Posizione iniziale: più in basso + leggermente zoomata OUT
    requestAnimationFrame(() => {
      repositionDownWithMargin();
    });

    return () => {
      try {
        map?.destroy?.();
      } catch {}
      if (container) {
        const styleEl = container.querySelector<HTMLStyleElement>(
          'style[mock-hide-svg-text="true"]'
        );
        styleEl?.remove();
      }
      mapRef.current = null;
    };
  }, [containerId, onRegionSelect, repositionDownWithMargin]);

  return (
    <div className={className}>
      <div
        id={containerId}
        className="h-full w-full"
        style={{
          height: "100%",
          borderRadius: 12,
          overflow: "hidden",
        }}
      />
    </div>
  );
}
