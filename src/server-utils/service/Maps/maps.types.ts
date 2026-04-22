export type MapsProviderName = "mapbox" | "geoapify";

export type MapsGeoPoint = {
  lat: number;
  lng: number;
};

export type MapsAddress = {
  street?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
  extra?: string;
};

export type MapsGeocodeResult = {
  label: string;
  geoPoint: MapsGeoPoint;
  address?: MapsAddress;
};

export type MapsRuntimeConfig = {
  provider: MapsProviderName;
  enabled: boolean;
  publicToken?: string | null;
  staticStyle?: string | null;
  defaultCenter?: MapsGeoPoint | null;
};

export type ForwardGeocodeArgs = {
  query: string;
  limit?: number;
  country?: string;
  language?: string;
};

export type ReverseGeocodeArgs = {
  geoPoint: MapsGeoPoint;
  language?: string;
  country?: string;
};

export interface MapsProvider {
  getRuntimeConfig(): MapsRuntimeConfig;
  forwardGeocode(args: ForwardGeocodeArgs): Promise<MapsGeocodeResult[]>;
  reverseGeocode(args: ReverseGeocodeArgs): Promise<MapsGeocodeResult | null>;
}
