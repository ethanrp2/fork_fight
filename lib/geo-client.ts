/** @client */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from './geo';

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



