/**
 * Phase 1 - Pure Geolocation Utilities
 * Server-compatible pure functions with no side effects.
 * No React imports, no DOM/browser APIs.
 */

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Parse lat/lng from a Google Maps URL.
 * Supports "...@lat,lng,..." and "...?q=lat,lng".
 */
export function parseLatLngFromMapsUrl(mapsUrl?: string | null): LatLng | null {
  if (!mapsUrl) return null;
  const atMatch = mapsUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  }
  const qMatch = mapsUrl.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (qMatch) {
    return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
  }
  return null;
}

/**
 * Haversine distance in miles between two coordinates.
 */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}
