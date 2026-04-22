export type MapsProviderKey = "mapbox" | "geoapify";

function normalizeProvider(raw: string | undefined): MapsProviderKey {
  return raw === "mapbox" ? "mapbox" : "geoapify";
}

function parseNumber(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const MAPS_CONFIG = {
  provider: normalizeProvider(process.env.MAPS_PROVIDER || process.env.NEXT_PUBLIC_MAPS_PROVIDER),
  defaultLanguage: "it",
  defaultCountry: "IT",
  defaultCenter: {
    lat: parseNumber(process.env.MAPS_DEFAULT_LAT, 41.8391),
    lng: parseNumber(process.env.MAPS_DEFAULT_LNG, 12.8866),
    label: process.env.MAPS_DEFAULT_LABEL || "Palestrina / sede Evolve",
  },
  staticPreview: {
    width: 900,
    height: 320,
    zoom: 14,
  },
  providers: {
    mapbox: {
      publicToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null,
      staticStyle: "mapbox/dark-v11",
    },
    geoapify: {
      publicToken: process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || null,
      staticStyle: "osm-bright-smooth",
    },
  },
} as const;
