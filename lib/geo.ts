import { useCallback, useEffect, useState } from 'react';

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

/**
 * Hook to get and persist user's geolocation.
 * Stores in localStorage to persist across navigation.
 */
export function useUserLocation() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ff_user_location');
      if (saved) {
        const parsed = JSON.parse(saved) as LatLng;
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
          setCoords(parsed);
        }
      }
    } catch {
      // ignore
    }
    // Listen to cross-tab storage changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ff_user_location') {
        try {
          if (e.newValue) {
            const parsed = JSON.parse(e.newValue) as LatLng;
            if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
              setCoords(parsed);
            }
          } else {
            setCoords(null);
          }
        } catch {}
      }
    };
    // Listen to same-tab updates via custom event
    const onCustom = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as LatLng | null;
        if (detail && typeof detail.lat === 'number' && typeof detail.lng === 'number') {
          setCoords(detail);
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('ff_user_location_updated', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ff_user_location_updated', onCustom as EventListener);
    };
  }, []);

  // Check permission if available
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: 'geolocation' as any })
        .then((p: any) => {
          if (cancelled) return;
          setPermission(p.state as any);
          p.onchange = () => setPermission(p.state as any);
        })
        .catch(() => setPermission('unknown'));
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const requestLocation = useCallback(async () => {
    setError(null);
    if (!navigator?.geolocation) {
      setError('Geolocation not supported');
      return null;
    }
    return new Promise<LatLng | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(next);
          try {
            localStorage.setItem('ff_user_location', JSON.stringify(next));
            window.dispatchEvent(new CustomEvent('ff_user_location_updated', { detail: next }));
          } catch {}
          resolve(next);
        },
        (err) => {
          setError(err.message || 'Failed to get location');
          resolve(null);
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
      );
    });
  }, []);

  const clearLocation = useCallback(() => {
    setCoords(null);
    try {
      localStorage.removeItem('ff_user_location');
      window.dispatchEvent(new CustomEvent('ff_user_location_updated', { detail: null }));
    } catch {}
  }, []);

  return { coords, error, permission, requestLocation, clearLocation };
}

