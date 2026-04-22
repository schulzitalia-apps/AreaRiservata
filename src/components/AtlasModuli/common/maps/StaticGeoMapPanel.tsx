"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildOpenStreetMapEmbedUrl, buildStaticMapImageUrl } from "./mapbox-static";

type GeoPointValue = {
  lat: number;
  lng: number;
};

type MapsRuntime = {
  provider: "mapbox" | "geoapify";
  enabled: boolean;
  publicToken?: string | null;
  staticStyle?: string | null;
  defaultCenter?: GeoPointValue | null;
};

export function StaticGeoMapPanel({
  geoPoint,
  title,
  subtitle,
  emptyMessage = "Nessuna posizione selezionata.",
  heightClassName = "h-[220px]",
  className,
  mode = "interactive",
  showFallbackCenter = false,
}: {
  geoPoint?: GeoPointValue | null;
  title?: ReactNode;
  subtitle?: ReactNode;
  emptyMessage?: ReactNode;
  heightClassName?: string;
  className?: string;
  mode?: "interactive" | "static";
  showFallbackCenter?: boolean;
}) {
  const [runtime, setRuntime] = useState<MapsRuntime | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/maps/config", {
          method: "GET",
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (cancelled || !res.ok) return;
        setRuntime({
          provider: json?.provider === "mapbox" ? "mapbox" : "geoapify",
          enabled: Boolean(json?.enabled),
          publicToken: typeof json?.publicToken === "string" ? json.publicToken : null,
          staticStyle: typeof json?.staticStyle === "string" ? json.staticStyle : null,
          defaultCenter:
            json?.defaultCenter &&
            Number.isFinite(Number(json.defaultCenter.lat)) &&
            Number.isFinite(Number(json.defaultCenter.lng))
              ? {
                  lat: Number(json.defaultCenter.lat),
                  lng: Number(json.defaultCenter.lng),
                }
              : null,
        });
      } catch {
        if (!cancelled) setRuntime(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveGeoPoint = useMemo(() => {
    if (geoPoint) return geoPoint;
    if (showFallbackCenter && runtime?.defaultCenter) return runtime.defaultCenter;
    return null;
  }, [geoPoint, runtime, showFallbackCenter]);

  const previewUrl = useMemo(() => {
    if (!effectiveGeoPoint || !runtime?.enabled || !runtime?.publicToken) return null;
    return buildStaticMapImageUrl({
      geoPoint: effectiveGeoPoint,
      provider: runtime.provider,
      token: runtime.publicToken,
      style: runtime.staticStyle,
      width: 900,
      height: 320,
      zoom: 14,
    });
  }, [effectiveGeoPoint, runtime]);

  const embedUrl = useMemo(() => {
    if (!effectiveGeoPoint) return null;
    return buildOpenStreetMapEmbedUrl({
      geoPoint: effectiveGeoPoint,
      zoom: 14,
    });
  }, [effectiveGeoPoint]);

  const hasFallbackCenter = !geoPoint && !!effectiveGeoPoint;

  return (
    <div className={className}>
      {title ? <div className="mb-2 text-sm font-semibold text-dark dark:text-white">{title}</div> : null}
      <div className="overflow-hidden rounded-2xl border border-stroke bg-black/20 dark:border-dark-3">
        {mode === "interactive" && embedUrl ? (
          <iframe
            title={typeof title === "string" ? title : "Mappa"}
            src={embedUrl}
            className={`w-full border-0 ${heightClassName}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : previewUrl ? (
          <div
            className={`w-full bg-cover bg-center ${heightClassName}`}
            style={{ backgroundImage: `url('${previewUrl}')` }}
          />
        ) : (
          <div
            className={`flex items-center justify-center px-6 text-center text-sm text-dark/55 dark:text-white/55 ${heightClassName}`}
          >
            {emptyMessage}
          </div>
        )}
      </div>
      {subtitle || hasFallbackCenter ? (
        <div className="mt-3 rounded-xl border border-stroke bg-white/[0.03] px-3 py-2 text-xs text-dark/60 dark:border-dark-3 dark:text-white/60">
          <div className="space-y-1">
            {hasFallbackCenter ? (
              <div>Centro iniziale di default: Palestrina / sede Evolve. Puoi poi cercare o sostituire il geoPoint.</div>
            ) : null}
            {subtitle ? <div>{subtitle}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
