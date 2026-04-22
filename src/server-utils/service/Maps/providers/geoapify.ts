import { MAPS_CONFIG } from "@/config/maps.config";
import type {
  ForwardGeocodeArgs,
  MapsAddress,
  MapsGeocodeResult,
  MapsProvider,
  MapsRuntimeConfig,
  ReverseGeocodeArgs,
} from "../maps.types";

const GEOAPIFY_GEOCODE_BASE = "https://api.geoapify.com/v1/geocode";

function getGeoapifyServerToken() {
  return process.env.GEOAPIFY_API_KEY || process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || "";
}

function getGeoapifyPublicToken() {
  return process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || process.env.GEOAPIFY_API_KEY || null;
}

function normalizeGeoapifyFeature(feature: any): MapsGeocodeResult | null {
  const lat = typeof feature?.properties?.lat === "number" ? feature.properties.lat : null;
  const lng = typeof feature?.properties?.lon === "number" ? feature.properties.lon : null;
  if (lat === null || lng === null) return null;

  const address: MapsAddress = {
    street:
      String(feature?.properties?.address_line1 ?? "").trim() ||
      [feature?.properties?.housenumber, feature?.properties?.street].filter(Boolean).join(" ").trim() ||
      undefined,
    city:
      String(
        feature?.properties?.city ??
          feature?.properties?.town ??
          feature?.properties?.village ??
          "",
      ).trim() || undefined,
    zip: String(feature?.properties?.postcode ?? "").trim() || undefined,
    province:
      String(feature?.properties?.state ?? feature?.properties?.county ?? "").trim() || undefined,
    country: String(feature?.properties?.country ?? "").trim() || undefined,
  };

  return {
    label:
      String(
        feature?.properties?.formatted ??
          feature?.properties?.address_line1 ??
          feature?.properties?.name ??
          "",
      ).trim() || "Risultato senza etichetta",
    geoPoint: { lat, lng },
    address: Object.values(address).some(Boolean) ? address : undefined,
  };
}

async function fetchGeoapifyJson(pathname: string, params: URLSearchParams) {
  const token = getGeoapifyServerToken();
  if (!token) {
    throw new Error("Geoapify non configurato: manca GEOAPIFY_API_KEY o NEXT_PUBLIC_GEOAPIFY_API_KEY.");
  }

  params.set("apiKey", token);
  const response = await fetch(`${GEOAPIFY_GEOCODE_BASE}${pathname}?${params.toString()}`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Geoapify geocoding error (${response.status})`);
  }

  return response.json();
}

export const geoapifyMapsProvider: MapsProvider = {
  getRuntimeConfig(): MapsRuntimeConfig {
    return {
      provider: "geoapify",
      enabled: Boolean(getGeoapifyServerToken()),
      publicToken: getGeoapifyPublicToken(),
      staticStyle: MAPS_CONFIG.providers.geoapify.staticStyle,
      defaultCenter: MAPS_CONFIG.defaultCenter,
    };
  },

  async forwardGeocode(args: ForwardGeocodeArgs) {
    const params = new URLSearchParams({
      text: args.query,
      limit: String(Math.min(Math.max(args.limit ?? 5, 1), 10)),
      lang: args.language ?? MAPS_CONFIG.defaultLanguage,
      filter: `countrycode:${(args.country ?? MAPS_CONFIG.defaultCountry).toLowerCase()}`,
      format: "geojson",
    });

    const json = await fetchGeoapifyJson("/search", params);
    const features = Array.isArray(json?.features) ? json.features : [];
    return features
      .map(normalizeGeoapifyFeature)
      .filter(Boolean) as MapsGeocodeResult[];
  },

  async reverseGeocode(args: ReverseGeocodeArgs) {
    const params = new URLSearchParams({
      lat: String(args.geoPoint.lat),
      lon: String(args.geoPoint.lng),
      lang: args.language ?? MAPS_CONFIG.defaultLanguage,
      format: "geojson",
    });

    const json = await fetchGeoapifyJson("/reverse", params);
    const features = Array.isArray(json?.features) ? json.features : [];
    const first = features.map(normalizeGeoapifyFeature).find(Boolean);
    return first ?? null;
  },
};
