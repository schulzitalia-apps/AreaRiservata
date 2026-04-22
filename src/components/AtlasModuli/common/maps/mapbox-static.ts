export type StaticMapGeoPoint = {
  lat: number;
  lng: number;
};

export function buildStaticMapImageUrl(args: {
  geoPoint: StaticMapGeoPoint;
  provider: "mapbox" | "geoapify";
  token?: string | null;
  style?: string | null;
  width?: number;
  height?: number;
  zoom?: number;
}) {
  const { geoPoint, provider, token, style, width = 800, height = 320, zoom = 14 } = args;
  if (!token) return null;

  const lng = Number(geoPoint.lng);
  const lat = Number(geoPoint.lat);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (provider === "geoapify") {
    const params = new URLSearchParams({
      style: style || "osm-bright-smooth",
      width: String(Math.round(width)),
      height: String(Math.round(height)),
      center: `lonlat:${lng},${lat}`,
      zoom: String(zoom),
      marker: `lonlat:${lng},${lat};color:%2310b981;size:medium`,
      apiKey: token,
    });
    return `https://maps.geoapify.com/v1/staticmap?${params.toString()}`;
  }

  const encodedOverlay = encodeURIComponent(`pin-s+10b981(${lng},${lat})`);
  const mapboxStyle = style || "mapbox/dark-v11";
  return `https://api.mapbox.com/styles/v1/${mapboxStyle}/static/${encodedOverlay}/${lng},${lat},${zoom}/` +
    `${Math.round(width)}x${Math.round(height)}?access_token=${encodeURIComponent(token)}`;
}

export function buildOpenStreetMapEmbedUrl(args: {
  geoPoint: StaticMapGeoPoint;
  zoom?: number;
}) {
  const { geoPoint, zoom = 14 } = args;
  const lng = Number(geoPoint.lng);
  const lat = Number(geoPoint.lat);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const lngDelta = Math.max(0.0035, 0.05 / Math.max(zoom, 1));
  const latDelta = Math.max(0.0025, 0.035 / Math.max(zoom, 1));

  const left = lng - lngDelta;
  const right = lng + lngDelta;
  const top = lat + latDelta;
  const bottom = lat - latDelta;

  const params = new URLSearchParams({
    bbox: `${left},${bottom},${right},${top}`,
    layer: "mapnik",
    marker: `${lat},${lng}`,
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}
