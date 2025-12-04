'use client';

import Image from 'next/image';
import Link from 'next/link';
import useSWR from 'swr';
import { useState, useRef, useMemo } from 'react';
import type { SortableCategory } from '@/types/restaurant';
import type { ApiResponse, RankingsResponse, RankingEntry } from '@/types/api';
import { useAuthUser } from '@/lib/auth';
import RequireAuth from '@/components/RequireAuth';
import { haversineMiles, parseLatLngFromMapsUrl, useUserLocation } from '@/lib/geo';

export default function MyFavoritesPage() {
  const [category, setCategory] = useState<SortableCategory>('global');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const { user, loading } = useAuthUser();
  const { coords, requestLocation, clearLocation } = useUserLocation();

  const { data, isLoading } = useSWR(
    user ? ['personal-rankings', user.id, category] as const : null,
    async ([, userId, cat]) => {
      const res = await fetch('/api/restaurants/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, category: cat }),
      });
      const json: ApiResponse<RankingsResponse> = await res.json();
      if (!json.ok) {
        throw new Error(json.error ?? 'Failed to load personal rankings');
      }
      return json.data!;
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateOnMount: true,
    }
  );

  const rankings = data?.rankings ?? [];

  const getCategoryDisplayName = (cat: SortableCategory): string => {
    switch (cat) {
      case 'global':
        return 'All';
      case 'value':
        return 'Value';
      case 'aesthetics':
        return 'Aesthetics';
      case 'speed':
        return 'Speed';
      default:
        return 'All';
    }
  };

  const handleShare = async () => {
    const top5 = rankings.slice(0, 5);
    
    if (top5.length < 5) {
      return;
    }

    const categoryName = getCategoryDisplayName(category);
    const shareText = `My Top 5 Restaurants - ${categoryName}\n\n${top5.map((r, idx) => `${idx + 1}. ${r.name}`).join('\n')}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `My Top 5 Restaurants - ${categoryName}`,
          text: shareText,
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
        setShareFeedback('Copied to clipboard!');
        setTimeout(() => setShareFeedback(null), 2000);
      } else {
        // Fallback for very old browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setShareFeedback('Copied to clipboard!');
          setTimeout(() => setShareFeedback(null), 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err: any) {
      // User cancelled or error occurred
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  };

  const canShare = rankings.length >= 5 && !isLoading;

  return (
    <RequireAuth>
    <div className="flex flex-col h-[calc(100svh-80px-env(safe-area-inset-top))] min-h-0 bg-white">
      {/* Fixed Header */}
      <div className="shrink-0 pt-6 pb-4 bg-white relative">
        <div className="flex items-center justify-center mb-4">
          <h1 className="text-[35px] font-bold text-[#222222]">
            My Favorites
          </h1>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[16px] font-normal text-[#222222]">Sort By:</span>
            <div className="relative">
              <select
                className="appearance-none bg-[#741B3F] text-white text-[16px] h-[26px] rounded-[10px] px-3 pr-7"
                value={category}
                onChange={(e) => setCategory(e.target.value as SortableCategory)}
                aria-label="Sort rankings by category"
              >
                <option value="global">All</option>
                <option value="value">Value</option>
                <option value="aesthetics">Aesthetics</option>
                <option value="speed">Speed</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1 text-white">⌄</span>
            </div>
          </div>
          {!coords ? (
            <button
              className="px-3 h-[26px] rounded-[10px] bg-[#741B3F] text-white text-[14px]"
              onClick={() => requestLocation()}
            >
              Use my location
            </button>
          ) : (
            <div className="inline-flex gap-2">
              <button
                className="px-3 h-[26px] rounded-[10px] bg-[#741B3F] text-white text-[14px]"
                onClick={() => requestLocation()}
              >
                Update location
              </button>
              <button
                className="px-3 h-[26px] rounded-[10px] bg-[#f1e6ea] text-[#222222] text-[14px]"
                onClick={() => clearLocation()}
              >
                Clear
              </button>
            </div>
          )}
          <div className="flex flex-col items-end gap-1">
            <button
              className="h-[36px] w-[32px] relative shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Share top 5 restaurants"
              onClick={handleShare}
              disabled={!canShare}
            >
              <Image
                src="/icons/share.svg"
                alt=""
                fill
                className="object-contain"
                sizes="32px"
              />
            </button>
            {shareFeedback && (
              <span className="text-[12px] text-[#741B3F] whitespace-nowrap">
                {shareFeedback}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-[17px] pb-4">
          {loading ? (
            <p className="px-2 text-zinc-600">Loading…</p>
          ) : !user ? (
            <div className="px-2">
              <p className="text-zinc-800">Sign in to see your personal rankings.</p>
              <div className="mt-3 flex gap-2">
                <Link className="px-4 py-2 rounded-lg bg-[#741B3F] text-white" href="/login">Login</Link>
                <Link className="px-4 py-2 rounded-lg border border-[#741B3F] text-[#741B3F]" href="/register">Register</Link>
              </div>
            </div>
          ) : isLoading ? (
            <p className="px-2 text-zinc-600">Loading your rankings…</p>
          ) : rankings.length === 0 ? (
            <p className="px-2 text-zinc-800">No votes yet. Start ranking to build your list!</p>
          ) : (
            rankings.map((restaurant) => (
              <RankingRow key={restaurant.id} restaurant={restaurant} userCoords={coords} />
            ))
          )}
        </div>
      </div>
    </div>
    </RequireAuth>
  );
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function RankingRow({ restaurant, userCoords }: { restaurant: RankingEntry; userCoords: { lat: number; lng: number } | null }) {
  const rankBg = restaurant.rank <= 3 ? '#741B3F' : '#C87F9C';
  const longPressTimer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const hasLongPressed = useRef(false);
  const dynamicMiles = useMemo(() => {
    if (userCoords) {
      const lat = (restaurant as any).lat;
      const lng = (restaurant as any).lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return haversineMiles(userCoords, { lat, lng });
      }
      if (restaurant.mapsUrl) {
        const ll = parseLatLngFromMapsUrl(restaurant.mapsUrl);
        if (ll) {
          return haversineMiles(userCoords, ll);
        }
      }
    }
    return restaurant.distanceMiles;
  }, [userCoords, restaurant]);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    hasLongPressed.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      hasLongPressed.current = true;
      // Long press handler - placeholder for future functionality
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > 8 && longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerUp = () => {
    start.current = null;
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      className="flex items-center gap-[11px] touch-pan-y select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="group"
      aria-label={`${restaurant.name}, ${formatDistance(dynamicMiles)}`}
    >
      <div
        className="h-[66px] w-[71px] rounded-[15px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: rankBg }}
        aria-label={`Rank ${restaurant.rank}`}
      >
        <span className="text-white text-[25px] font-bold">{restaurant.rank}</span>
      </div>

      <div className="flex-1 rounded-[15px] bg-[#F7DCAD] p-[10px]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#222222] text-[25px] font-bold leading-none">
              {restaurant.name}
            </p>
            <p className="text-[#222222] text-[16px] font-normal leading-none mt-1">
              {formatDistance(dynamicMiles)}
            </p>
          </div>
          {restaurant.mapsUrl ? (
            <a
              href={restaurant.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="h-[40px] w-[41px] relative shrink-0"
              aria-label={`Open ${restaurant.name} in Maps`}
            >
              <Image
                src="/icons/loc_pin.svg"
                alt=""
                fill
                className="object-contain"
                sizes="41px"
              />
            </a>
          ) : (
            <div className="h-[40px] w-[41px] relative shrink-0">
              <Image
                src="/icons/loc_pin.svg"
                alt=""
                fill
                className="object-contain"
                sizes="41px"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function formatDistance(miles?: number) {
  if (typeof miles !== 'number' || Number.isNaN(miles)) return '—';
  return `${miles.toFixed(1)} mi away`;
}

