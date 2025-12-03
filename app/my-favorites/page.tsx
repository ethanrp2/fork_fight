'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import type { SortableCategory } from '@/types/restaurant';
import { SORTABLE_CATEGORIES } from '@/types/restaurant';

// Mock data for UI-only implementation
const mockRestaurants = [
  { id: '1', name: 'Bangkok Thai', rank: 1, distanceMiles: 0.5, mapsUrl: 'https://maps.google.com' },
  { id: '2', name: 'Papa Del\'s Pizza', rank: 2, distanceMiles: 0.8, mapsUrl: 'https://maps.google.com' },
  { id: '3', name: 'Maize Mexican Grill', rank: 3, distanceMiles: 1.2, mapsUrl: 'https://maps.google.com' },
  { id: '4', name: 'Chipotle', rank: 4, distanceMiles: 0.9, mapsUrl: 'https://maps.google.com' },
  { id: '5', name: 'Sakanaya', rank: 5, distanceMiles: 1.5, mapsUrl: 'https://maps.google.com' },
  { id: '6', name: 'Black Dog', rank: 6, distanceMiles: 0.7, mapsUrl: 'https://maps.google.com' },
  { id: '7', name: 'Panda Express', rank: 7, distanceMiles: 1.1, mapsUrl: 'https://maps.google.com' },
  { id: '8', name: 'Subway', rank: 8, distanceMiles: 0.6, mapsUrl: 'https://maps.google.com' },
  { id: '9', name: 'Jimmy John\'s', rank: 9, distanceMiles: 1.0, mapsUrl: 'https://maps.google.com' },
  { id: '10', name: 'Potbelly', rank: 10, distanceMiles: 1.3, mapsUrl: 'https://maps.google.com' },
  { id: '11', name: 'Noodles & Company', rank: 11, distanceMiles: 0.4, mapsUrl: 'https://maps.google.com' },
  { id: '12', name: 'Starbucks', rank: 12, distanceMiles: 0.3, mapsUrl: 'https://maps.google.com' },
  { id: '13', name: 'Dunkin\'', rank: 13, distanceMiles: 1.4, mapsUrl: 'https://maps.google.com' },
  { id: '14', name: 'McDonald\'s', rank: 14, distanceMiles: 0.9, mapsUrl: 'https://maps.google.com' },
  { id: '15', name: 'Taco Bell', rank: 15, distanceMiles: 1.6, mapsUrl: 'https://maps.google.com' },
];

export default function MyFavoritesPage() {
  const [category, setCategory] = useState<SortableCategory>('global');

  return (
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
          <button
            className="h-[36px] w-[32px] relative shrink-0"
            aria-label="Share"
          >
            <Image
              src="/icons/share.svg"
              alt=""
              fill
              className="object-contain"
              sizes="32px"
            />
          </button>
        </div>
      </div>

      {/* Scrollable Restaurant Cards */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-[17px] pb-4">
          {mockRestaurants.map((restaurant) => (
            <RankingRow key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function RankingRow({ restaurant }: { restaurant: typeof mockRestaurants[number] }) {
  const rankBg = restaurant.rank <= 3 ? '#741B3F' : '#C87F9C';
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
      aria-label={`${restaurant.name}, ${formatDistance(restaurant.distanceMiles)}`}
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
              {formatDistance(restaurant.distanceMiles)}
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

