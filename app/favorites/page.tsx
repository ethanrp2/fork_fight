'use client';

import Image from 'next/image';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import type { ApiResponse, RankingsResponse } from '@/types/api';
import type { SortableCategory } from '@/types/restaurant';
import { SORTABLE_CATEGORIES } from '@/types/restaurant';
import { haversineMiles, parseLatLngFromMapsUrl, useUserLocation } from '@/lib/geo';

export default function FavoritesPage() {
  const [category, setCategory] = useState<SortableCategory>('global');
  const { data, isLoading, error } = useSWR(
    ['rankings', category] as const,
    fetchRankings
  );
  const { coords, requestLocation } = useUserLocation();

  const distanceById = useMemo(() => {
    if (!coords || !data?.data?.rankings) return null;
    const map = new Map<string, number>();
    for (const r of data.data.rankings) {
      if (!r.mapsUrl) continue;
      const ll = parseLatLngFromMapsUrl(r.mapsUrl);
      if (ll) map.set(r.id, haversineMiles(coords, ll));
    }
    return map;
  }, [coords, data]);

  const rankings = data?.data?.rankings ?? [];

  return (
    <div className="pt-6 pb-28">
      <h1 className="text-[35px] font-bold text-[#222222]">UIUC Favorites</h1>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-[16px] text-[#222222]">Sort By:</span>
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
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-4">
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
              overrideMiles={distanceById?.get(r.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function RankingRow({ entry, overrideMiles }: { entry: RankingsResponse['rankings'][number]; overrideMiles?: number }) {
  const rankBg =
    entry.rank <= 3 ? '#741B3F' : '#C87F9C'; // Top 3 highlighted darker
  const dynamicMiles = overrideMiles ?? entry.distanceMiles;

  return (
    <div className="flex items-center gap-[11px]">
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
            <p className="text-[16px] leading-none mt-1">
              {formatDistance(dynamicMiles)}
            </p>
          </div>
          <div className="h-[40px] w-[41px] relative shrink-0">
            <Image
              src="/window.svg"
              alt=""
              fill
              className="object-contain"
              sizes="41px"
            />
          </div>
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

// -----------------------------------------------------------------------------
// Data
// -----------------------------------------------------------------------------

async function fetchRankings([_key, category]: readonly [string, SortableCategory]) {
  const res = await fetch(`/api/restaurants?category=${category}`, {
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

function formatDistance(miles: number) {
  if (typeof miles !== 'number' || Number.isNaN(miles)) return '—';
  return `${miles.toFixed(1)} mi away`;
}
