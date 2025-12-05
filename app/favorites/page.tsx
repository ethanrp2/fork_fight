'use client';

import Image from 'next/image';
import useSWR from 'swr';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiResponse, RankingsResponse } from '@/types/api';
import type { SortableCategory } from '@/types/restaurant';
import { SORTABLE_CATEGORIES, VOTABLE_CATEGORIES } from '@/types/restaurant';
import { haversineMiles, parseLatLngFromMapsUrl, useUserLocation } from '@/lib/geo';

export default function FavoritesPage() {
  const [category, setCategory] = useState<SortableCategory>('global');
  const [sheetEntry, setSheetEntry] = useState<RankingsResponse['rankings'][number] | null>(null);

  // Initialize category from URL (?category=...) or survey's sticky category (sessionStorage)
  useEffect(() => {
    try {
      // Prefer explicit URL param if present
      const params = new URLSearchParams(window.location.search);
      const urlCategory = params.get('category');
      if (urlCategory && SORTABLE_CATEGORIES.includes(urlCategory as SortableCategory)) {
        setCategory(urlCategory as SortableCategory);
        return;
      }
      // Otherwise, mirror the survey's current category (value/aesthetics/speed)
      const raw = sessionStorage.getItem('ff_survey_category');
      if (raw != null) {
        const surveyCat = JSON.parse(raw) as string;
        if (VOTABLE_CATEGORIES.includes(surveyCat as any)) {
          setCategory(surveyCat as SortableCategory);
        }
      }
    } catch {
      // ignore failures to read storage/URL
    }
  }, []);
  const { coords, requestLocation, clearLocation } = useUserLocation();
  const { data, isLoading, error } = useSWR(
    ['rankings', category, coords?.lat ?? null, coords?.lng ?? null] as const,
    fetchRankings
  );

  const rankings = data?.data?.rankings ?? [];

  return (
    <div className="flex flex-col h-[calc(100svh-80px-env(safe-area-inset-top))] min-h-0 bg-white">
      {/* Fixed Header */}
      <div className="shrink-0 pt-6 pb-4 bg-white">
        <div className="flex items-center justify-center mb-4">
          <h1 className="text-[35px] font-bold text-[#222222]">UIUC Favorites</h1>
        </div>

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
        </div>
      </div>

      {/* Scrollable Restaurant Cards */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-[17px] pb-4">
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : error ? (
            <ErrorState />
          ) : (
            rankings.map((r) => (
              <RankingRow
                key={r.id}
                entry={r}
                onLongPress={() => setSheetEntry(r)}
              />
            ))
          )}
        </div>
      </div>

      <RestaurantSheet
        entry={sheetEntry}
        onClose={() => setSheetEntry(null)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function RankingRow({
  entry,
  onLongPress,
}: {
  entry: RankingsResponse['rankings'][number];
  onLongPress: () => void;
}) {
  const rankBg =
    entry.rank <= 3 ? '#741B3F' : '#C87F9C'; // Top 3 highlighted darker
  const dynamicMiles = entry.distanceMiles;
  const longPressTimer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const hasLongPressed = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    hasLongPressed.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      hasLongPressed.current = true;
      onLongPress();
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
      aria-label={`${entry.name}, ${formatDistance(dynamicMiles)}`}
    >
      <div
        className="h-[66px] w-[71px] rounded-[15px] flex items-center justify-center"
        style={{ backgroundColor: rankBg }}
        aria-label={`Rank ${entry.rank}`}
      >
        <span className="text-white text-[25px] font-bold">{entry.rank}</span>
      </div>

      <div className="flex-1 rounded-[15px] bg-[#F7DCAD] p-[10px]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#222222] text-[25px] font-bold leading-none">
              {entry.name}
            </p>
            <p className="text-[#222222] text-[16px] font-normal leading-none mt-1">
              {formatDistance(dynamicMiles)}
            </p>
          </div>
          {entry.mapsUrl ? (
            <a
              href={entry.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="h-[40px] w-[41px] relative shrink-0"
              aria-label={`Open ${entry.name} in Maps`}
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

function SkeletonRow() {
  return (
    <div className="flex items-center gap-[11px]">
      <div className="h-[66px] w-[71px] rounded-[15px] bg-zinc-200 animate-pulse" />
      <div className="h-[66px] rounded-[15px] bg-zinc-200 flex-1 animate-pulse" />
    </div>
  );
}

function ErrorState() {
  return (
    <div className="p-4 rounded-xl border border-red-200 text-red-700">
      Failed to load rankings. Please try again later.
    </div>
  );
}

function RestaurantSheet(props: {
  entry: RankingsResponse['rankings'][number] | null;
  onClose: () => void;
}) {
  const { entry, onClose } = props;
  const { coords } = useUserLocation();
  const dynamicMiles = useMemo(() => {
    if (coords && entry?.mapsUrl) {
      const ll = parseLatLngFromMapsUrl(entry.mapsUrl);
      if (ll) return haversineMiles(coords, ll);
    }
    return entry?.distanceMiles;
  }, [coords, entry]);
  if (!entry) return null;
  const src = getRankingImageSrc(entry);

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.name} details`}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-[480px] rounded-t-2xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{entry.name}</h2>
          <button
            className="h-8 w-8 rounded-full bg-zinc-100"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-3 h-[180px] relative rounded-xl overflow-hidden">
          <Image src={src} alt="" fill className="object-cover" />
        </div>
        <div className="mt-3 text-sm text-zinc-700">
          <p>Distance: {formatDistance(dynamicMiles)}</p>
          {entry.mapsUrl ? (
            <p className="mt-1">
              <a
                className="text-[#741B3F] underline"
                href={entry.mapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open in Maps
              </a>
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="px-4 py-2 rounded-lg bg-[#741B3F] text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Data
// -----------------------------------------------------------------------------

async function fetchRankings(
  [_key, category, lat, lng]: readonly [string, SortableCategory, number | null, number | null]
) {
  const params = new URLSearchParams({ category });
  if (typeof lat === 'number' && typeof lng === 'number') {
    params.set('userLat', String(lat));
    params.set('userLng', String(lng));
  }
  const res = await fetch(`/api/restaurants?${params.toString()}`, {
    cache: 'no-store',
  });
  const json: ApiResponse<RankingsResponse> = await res.json();
  if (!json.ok) {
    throw new Error(json.error ?? 'Failed to load rankings');
  }
  return json;
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function formatDistance(miles?: number) {
  if (typeof miles !== 'number' || Number.isNaN(miles)) return '—';
  return `${miles.toFixed(1)} mi away`;
}

function getRankingImageSrc(entry: RankingsResponse['rankings'][number]): string {
  const { imageSlug } = entry;
  if (!imageSlug) return '/restaurants/placeholder.jpg';
  const isAbs = imageSlug.startsWith('http://') || imageSlug.startsWith('https://');
  return isAbs ? imageSlug : (imageSlug.startsWith('/') ? imageSlug : `/${imageSlug}`);
}
