import type {
  ForwardGeocodeArgs,
  MapsAddress,
  MapsGeocodeResult,
  MapsProvider,
  MapsRuntimeConfig,
  ReverseGeocodeArgs,
} from "../maps.types";
import { MAPS_CONFIG } from "@/config/maps.config";

const MAPBOX_GEOCODE_BASE = "https://api.mapbox.com/search/geocode/v6";

function getMapboxServerToken() {
  return process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
}

function getMapboxPublicToken() {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null;
}

function getFeatureLabel(feature: any): string {
  return (
    String(
      feature?.properties?.full_address ??
        feature?.properties?.place_formatted ??
        feature?.properties?.name ??
        feature?.place_name ??
        feature?.text ??
        "",
    ).trim() || "Risultato senza etichetta"
  );
}

function getFeatureGeoPoint(feature: any) {
  const coordinates = Array.isArray(feature?.geometry?.coordinates)
    ? feature.geometry.coordinates
    : Array.isArray(feature?.properties?.coordinates)
      ? feature.properties.coordinates
      : null;

  const lng = typeof coordinates?.[0] === "number" ? coordinates[0] : null;
  const lat = typeof coordinates?.[1] === "number" ? coordinates[1] : null;

  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function getContextName(feature: any, type: string): string | undefined {
  const context = feature?.properties?.context;
  const entry = context?.[type];
  if (!entry) return undefined;

  return String(entry?.name ?? entry?.place_name ?? "").trim() || undefined;
}

function getFeatureAddress(feature: any): MapsAddress | undefined {
  const street = String(
    feature?.properties?.full_address ??
      feature?.properties?.name ??
      feature?.properties?.address ??
      "",
  ).trim();

  const city =
    getContextName(feature, "place") ||
    getContextName(feature, "locality") ||
    getContextName(feature, "district");

  const zip = getContextName(feature, "postcode");
  const province = getContextName(feature, "region");
  const country = getContextName(feature, "country");

  const address: MapsAddress = {
    street: street || undefined,
    city,
    zip,
    province,
    country,
  };

  return Object.values(address).some(Boolean) ? address : undefined;
}

function normalizeMapboxFeature(feature: any): MapsGeocodeResult | null {
  const geoPoint = getFeatureGeoPoint(feature);
  if (!geoPoint) return null;

  return {
    label: getFeatureLabel(feature),
    geoPoint,
    address: getFeatureAddress(feature),
  };
}

async function fetchMapboxJson(pathname: string, params: URLSearchParams) {
  const token = getMapboxServerToken();
  if (!token) {
    throw new Error("Mapbox non configurato: manca MAPBOX_ACCESS_TOKEN o NEXT_PUBLIC_MAPBOX_TOKEN.");
  }

  params.set("access_token", token);
  const response = await fetch(`${MAPBOX_GEOCODE_BASE}${pathname}?${params.toString()}`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Mapbox geocoding error (${response.status})`);
  }

  return response.json();
}

export const mapboxMapsProvider: MapsProvider = {
  getRuntimeConfig(): MapsRuntimeConfig {
    return {
      provider: "mapbox",
      enabled: Boolean(getMapboxServerToken()),
      publicToken: getMapboxPublicToken(),
      staticStyle: MAPS_CONFIG.providers.mapbox.staticStyle,
      defaultCenter: MAPS_CONFIG.defaultCenter,
    };
  },

  async forwardGeocode(args: ForwardGeocodeArgs) {
    const params = new URLSearchParams({
      q: args.query,
      limit: String(Math.min(Math.max(args.limit ?? 5, 1), 10)),
      language: args.language ?? MAPS_CONFIG.defaultLanguage,
      country: args.country ?? MAPS_CONFIG.defaultCountry,
      types: "address,street,locality,place,postcode",
    });

    const json = await fetchMapboxJson("/forward", params);
    const features = Array.isArray(json?.features) ? json.features : [];

    return features
      .map(normalizeMapboxFeature)
      .filter(Boolean) as MapsGeocodeResult[];
  },

  async reverseGeocode(args: ReverseGeocodeArgs) {
    const params = new URLSearchParams({
      longitude: String(args.geoPoint.lng),
      latitude: String(args.geoPoint.lat),
      language: args.language ?? MAPS_CONFIG.defaultLanguage,
      country: args.country ?? MAPS_CONFIG.defaultCountry,
      types: "address,street,locality,place,postcode",
    });

    const json = await fetchMapboxJson("/reverse", params);
    const features = Array.isArray(json?.features) ? json.features : [];
    const first = features.map(normalizeMapboxFeature).find(Boolean);
    return first ?? null;
  },
};
