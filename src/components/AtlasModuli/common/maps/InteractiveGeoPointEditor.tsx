"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { AppButton, AppInput } from "@/components/ui";

type GeoPoint = {
  lat: number;
  lng: number;
};

type AddressValue = {
  street?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
  extra?: string;
};

type GeocodeItem = {
  label: string;
  geoPoint: GeoPoint;
  address?: AddressValue;
};

type MapsRuntime = {
  provider: "mapbox" | "geoapify";
  enabled: boolean;
  publicToken?: string | null;
  staticStyle?: string | null;
  defaultCenter?: GeoPoint | null;
};

function normalizeAddress(address?: AddressValue | null): AddressValue | null {
  if (!address) return null;
  const normalized = {
    street: String(address.street ?? "").trim() || undefined,
    city: String(address.city ?? "").trim() || undefined,
    zip: String(address.zip ?? "").trim() || undefined,
    province: String(address.province ?? "").trim() || undefined,
    country: String(address.country ?? "").trim() || undefined,
    extra: String(address.extra ?? "").trim() || undefined,
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function formatAddress(address?: AddressValue | null) {
  if (!address) return "";
  return [
    address.street,
    [address.zip, address.city].filter(Boolean).join(" "),
    [address.province, address.country].filter(Boolean).join(" - "),
    address.extra,
  ]
    .filter(Boolean)
    .join(", ");
}

export function InteractiveGeoPointEditor({
  value,
  onChange,
  onResolvedAddressChange,
}: {
  value?: GeoPoint | null;
  onChange: (point: GeoPoint) => void;
  onResolvedAddressChange?: (meta: { label?: string; address?: AddressValue | null } | null) => void;
}) {
  const [runtime, setRuntime] = useState<MapsRuntime | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<AddressValue | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const effectivePoint = useMemo(() => {
    const lat = Number(value?.lat);
    const lng = Number(value?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    if (runtime?.defaultCenter) return runtime.defaultCenter;
    return null;
  }, [value, runtime]);

  const hasExplicitValue = useMemo(() => {
    return Number.isFinite(Number(value?.lat)) && Number.isFinite(Number(value?.lng));
  }, [value]);

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

  const reverseResolve = useCallback(
    async (point: GeoPoint) => {
      setReverseLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/maps/reverse-geocode?lat=${encodeURIComponent(String(point.lat))}&lng=${encodeURIComponent(String(point.lng))}`,
          {
            method: "GET",
            credentials: "include",
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message || "Errore reverse geocoding");
        const item = json?.item ?? null;
        const address = normalizeAddress(item?.address);
        setResolvedAddress(address);
        setSelectedLabel(typeof item?.label === "string" ? item.label : null);
        onResolvedAddressChange?.({
          label: typeof item?.label === "string" ? item.label : undefined,
          address,
        });
      } catch (e: any) {
        setError(e?.message || "Errore localizzazione posizione.");
      } finally {
        setReverseLoading(false);
      }
    },
    [onResolvedAddressChange],
  );

  const ensureLeafletMap = useCallback(async () => {
    if (!mapContainerRef.current || !effectivePoint || mapRef.current) return;

    const L = await import("leaflet");
    leafletRef.current = L;

    const map = L.map(mapContainerRef.current, {
      center: [effectivePoint.lat, effectivePoint.lng],
      zoom: hasExplicitValue ? 16 : 13,
      scrollWheelZoom: true,
    });

    const tileUrl =
      runtime?.provider === "geoapify" && runtime.publicToken
        ? `https://maps.geoapify.com/v1/tile/${runtime.staticStyle || "osm-bright-smooth"}/{z}/{x}/{y}.png?apiKey=${runtime.publicToken}`
        : runtime?.provider === "mapbox" && runtime.publicToken
          ? `https://api.mapbox.com/styles/v1/${runtime.staticStyle || "mapbox/dark-v11"}/tiles/512/{z}/{x}/{y}@2x?access_token=${runtime.publicToken}`
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const tileOptions: Record<string, any> = {
      attribution:
        runtime?.provider === "geoapify" && runtime.publicToken
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles by Geoapify'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 20,
    };

    if (runtime?.provider === "mapbox" && runtime.publicToken) {
      tileOptions.tileSize = 512;
      tileOptions.zoomOffset = -1;
    }

    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `
        <div style="width:24px;height:24px;border-radius:999px;background:#84cc16;border:3px solid rgba(255,255,255,0.95);box-shadow:0 0 0 4px rgba(132,204,22,0.18),0 10px 26px rgba(0,0,0,0.28);"></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([effectivePoint.lat, effectivePoint.lng], {
      draggable: true,
      icon,
    }).addTo(map);

    map.on("click", (event: any) => {
      const point = {
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      };
      marker.setLatLng(event.latlng);
      onChange(point);
      void reverseResolve(point);
    });

    marker.on("dragend", () => {
      const latLng = marker.getLatLng();
      const point = {
        lat: latLng.lat,
        lng: latLng.lng,
      };
      onChange(point);
      void reverseResolve(point);
    });

    mapRef.current = map;
    markerRef.current = marker;
  }, [effectivePoint, hasExplicitValue, onChange, reverseResolve, runtime]);

  useEffect(() => {
    if (!runtime || !effectivePoint) return;
    void ensureLeafletMap();

    return () => {
      // noop: cleanup is handled in unmount effect below
    };
  }, [runtime, effectivePoint, ensureLeafletMap]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!effectivePoint || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([effectivePoint.lat, effectivePoint.lng]);
    mapRef.current.setView([effectivePoint.lat, effectivePoint.lng], mapRef.current.getZoom() || 16);
  }, [effectivePoint]);

  const selectResult = (item: GeocodeItem) => {
    setSelectedLabel(item.label);
    const normalizedAddress = normalizeAddress(item.address);
    setResolvedAddress(normalizedAddress);
    onChange(item.geoPoint);
    onResolvedAddressChange?.({
      label: item.label,
      address: normalizedAddress,
    });

    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([item.geoPoint.lat, item.geoPoint.lng]);
      mapRef.current.setView([item.geoPoint.lat, item.geoPoint.lng], 17);
    }
  };

  const performSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(trimmed)}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || "Errore geocoding");
      const items = Array.isArray(json?.items) ? json.items : [];
      setResults(items);
      if (items[0]) selectResult(items[0]);
    } catch (e: any) {
      setResults([]);
      setError(e?.message || "Errore geocoding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex-1">
          <AppInput
            label="Cerca indirizzo o luogo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Es. Via dei Castani 70, Palestrina"
            leadingSlot={<Search className="h-4 w-4" />}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void performSearch();
              }
            }}
          />
        </div>
        <div className="md:self-end">
          <AppButton onClick={performSearch} loading={loading} fullWidth>
            Cerca
          </AppButton>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stroke bg-black/20 dark:border-dark-3">
        <div ref={mapContainerRef} className="h-[220px] w-full" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/50 dark:text-white/50">
            Risultati ricerca
          </div>
          <div className="max-h-[190px] space-y-2 overflow-auto pr-1">
            {results.length > 0 ? (
              results.map((item, index) => (
                <button
                  key={`${item.label}__${index}`}
                  type="button"
                  onClick={() => selectResult(item)}
                  className="w-full rounded-xl border border-stroke bg-white/[0.03] px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] dark:border-dark-3"
                >
                  <div className="font-medium text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
                    {item.geoPoint.lat}, {item.geoPoint.lng}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-stroke px-3 py-4 text-xs text-dark/55 dark:border-dark-3 dark:text-white/55">
                Cerca un indirizzo oppure sposta il pin sulla mappa.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-stroke bg-white/[0.03] px-3 py-3 text-xs dark:border-dark-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dark/50 dark:text-white/50">
            Posizione attiva
          </div>
          {selectedLabel ? <div className="font-medium text-white">{selectedLabel}</div> : null}
          {effectivePoint ? (
            <div className="text-dark/60 dark:text-white/60">
              geoPoint: {effectivePoint.lat}, {effectivePoint.lng}
            </div>
          ) : null}
          {resolvedAddress ? (
            <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-2 text-dark/80 dark:text-white/80">
              {formatAddress(resolvedAddress)}
            </div>
          ) : null}
          {reverseLoading ? (
            <div className="text-dark/60 dark:text-white/60">Rilevamento indirizzo in corso...</div>
          ) : null}
          {!selectedLabel && !resolvedAddress && !reverseLoading ? (
            <div className="text-dark/55 dark:text-white/55">
              Il pin parte dal centro di default e puoi spostarlo con drag o click.
            </div>
          ) : null}
          {error ? <div className="text-red-300">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
