"use client";

import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { AppButton, AppInput, AppModal } from "@/components/ui";
import { StaticGeoMapPanel } from "./StaticGeoMapPanel";

type GeoPoint = { lat: number; lng: number };
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

export function MapPickerModal({
  open,
  onClose,
  initialGeoPoint,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  initialGeoPoint?: GeoPoint | null;
  onSelect: (item: GeocodeItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GeocodeItem | null>(null);
  const configLoading = false;
  const previewUrl: string | null = null;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setError(null);
      return;
    }

    if (
      initialGeoPoint &&
      Number.isFinite(Number(initialGeoPoint.lat)) &&
      Number.isFinite(Number(initialGeoPoint.lng))
    ) {
      setSelected({
        label: `Coordinate correnti: ${initialGeoPoint.lat}, ${initialGeoPoint.lng}`,
        geoPoint: initialGeoPoint,
      });
    }
  }, [open, initialGeoPoint]);

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
      setSelected(items[0] ?? null);
    } catch (e: any) {
      setResults([]);
      setSelected(null);
      setError(e?.message || "Errore geocoding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      title="Seleziona posizione"
      subtitle="La mappa lavora sul geoPoint. L'indirizzo viene usato come supporto descrittivo."
      footer={
        <div className="flex justify-end gap-2">
          <AppButton variant="outline" tone="neutral" onClick={onClose}>
            Chiudi
          </AppButton>
          <AppButton
            tone="success"
            onClick={() => {
              if (!selected) return;
              onSelect(selected);
              onClose();
            }}
            disabled={!selected}
          >
            Usa posizione
          </AppButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <AppInput
              label="Cerca indirizzo o luogo"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Es. Via Roma 1, Milano"
              leadingSlot={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="md:self-end">
            <AppButton onClick={performSearch} loading={loading} fullWidth>
              Cerca
            </AppButton>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-dark/50 dark:text-white/50">
              Risultati
            </div>

            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {results.map((item, index) => {
                const active =
                  selected?.geoPoint.lat === item.geoPoint.lat &&
                  selected?.geoPoint.lng === item.geoPoint.lng;

                return (
                  <button
                    key={`${item.label}__${index}`}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={[
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      active
                        ? "border-emerald-400/50 bg-emerald-400/10"
                        : "border-stroke bg-white/[0.03] hover:bg-white/[0.05] dark:border-dark-3",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <div className="min-w-0">
                        <div className="font-medium text-white">{item.label}</div>
                        <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
                          {item.geoPoint.lat}, {item.geoPoint.lng}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!loading && results.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stroke px-4 py-6 text-sm text-dark/55 dark:border-dark-3 dark:text-white/55">
                  Nessun risultato ancora. Cerca un indirizzo per scegliere la posizione.
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-dark/50 dark:text-white/50">
              Anteprima
            </div>

            <StaticGeoMapPanel
              geoPoint={selected?.geoPoint ?? initialGeoPoint ?? null}
              emptyMessage="La mappa comparira qui quando selezioni un risultato o apri il picker su un geoPoint gia valorizzato."
              heightClassName="h-[320px]"
              showFallbackCenter
            />

            <div className="hidden overflow-hidden rounded-2xl border border-stroke bg-black/20 dark:border-dark-3">
              {previewUrl ? (
                <div
                  className="h-[320px] w-full bg-cover bg-center"
                  style={{ backgroundImage: `url('${previewUrl}')` }}
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-dark/55 dark:text-white/55">
                  La preview statica comparirà quando selezioni un risultato e sarà basata sul geoPoint.
                </div>
              )}
            </div>

            {selected ? (
              <div className="rounded-2xl border border-stroke bg-white/[0.03] px-4 py-3 text-sm dark:border-dark-3">
                <div className="font-medium text-white">{selected.label}</div>
                <div className="mt-2 text-xs text-dark/60 dark:text-white/60">
                  geoPoint: {selected.geoPoint.lat}, {selected.geoPoint.lng}
                </div>
                {selected.address ? (
                  <div className="mt-2 text-xs text-dark/60 dark:text-white/60">
                    {[selected.address.street, selected.address.zip, selected.address.city, selected.address.province, selected.address.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppModal>
  );
}
