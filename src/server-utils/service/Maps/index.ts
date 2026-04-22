import { MAPS_CONFIG } from "@/config/maps.config";
import { geoapifyMapsProvider } from "./providers/geoapify";
import { mapboxMapsProvider } from "./providers/mapbox";
import type {
  ForwardGeocodeArgs,
  MapsProvider,
  ReverseGeocodeArgs,
} from "./maps.types";

function getMapsProvider(): MapsProvider {
  return MAPS_CONFIG.provider === "mapbox" ? mapboxMapsProvider : geoapifyMapsProvider;
}

export function getMapsRuntimeConfig() {
  return getMapsProvider().getRuntimeConfig();
}

export async function forwardGeocode(args: ForwardGeocodeArgs) {
  return getMapsProvider().forwardGeocode(args);
}

export async function reverseGeocode(args: ReverseGeocodeArgs) {
  return getMapsProvider().reverseGeocode(args);
}

export * from "./maps.types";
