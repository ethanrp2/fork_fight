'use client';

import Image from 'next/image';
import useSWR from 'swr';
import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  ApiResponse,
  MatchupResponse,
  UndoResponse,
  VoteResponse,
} from '@/types/api';
import type { Restaurant, VotableCategory } from '@/types/restaurant';
import { VOTABLE_CATEGORIES } from '@/types/restaurant';
import { getRestaurantImagePath } from '@/lib/image';

type CardSide = 'A' | 'B';

export default function Home() {
  const [category, setCategory] = useState<VotableCategory>('value');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [lastVoteId, setLastVoteId] = useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { data, isLoading, error, mutate } = useSWR(
    ['matchup', category, refreshIndex] as const,
    fetchMatchup
  );

  const matchup = data?.data?.matchup;
  const restaurantA = data?.data?.restaurantA;
  const restaurantB = data?.data?.restaurantB;

  const onCategoryChange = useCallback((newCat: VotableCategory) => {
    setCategory(newCat);
    setRefreshIndex((n) => n + 1);
  }, []);

  const handleVote = useCallback(
    async (winner: Restaurant, loser: Restaurant) => {
      if (!matchup) return;
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchupId: matchup.id,
          winnerId: winner.id,
          loserId: loser.id,
          category,
        }),
      });
      const json: ApiResponse<VoteResponse> = await res.json();
      if (json.ok) {
        setLastVoteId(json.data!.voteId);
        await mutate(); // get next matchup
      } else {
        console.error('Vote error:', json.error);
        alert(json.error ?? 'Vote failed');
      }
    },
    [category, matchup, mutate]
  );

  const handleSkip = useCallback(async () => {
    setRefreshIndex((n) => n + 1);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!lastVoteId) return;
    const res = await fetch('/api/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteId: lastVoteId }),
    });
    const json: ApiResponse<UndoResponse> = await res.json();
    if (!json.ok) {
      alert(json.error ?? 'Undo failed');
      return;
    }
    if (!json.data?.success) {
      alert(json.data?.reason ?? 'Nothing to undo');
      return;
    }
    // keep current matchup, just acknowledge
    alert('Last vote undone.');
    setLastVoteId(null);
  }, [lastVoteId]);

  const [sheetRestaurant, setSheetRestaurant] = useState<Restaurant | null>(
    null
  );

  return (
    <div className="pt-6 pb-28">
      <LogoHeader />

      <div className="mt-3">
        <p className="text-[#222222] text-[16px]">Currently Ranking Based On:</p>
        <CategorySelector
          value={category}
          onChange={onCategoryChange}
        />
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <ErrorState onRetry={() => setRefreshIndex((n) => n + 1)} />
        ) : restaurantA && restaurantB && matchup ? (
          <>
            <SwipeableCard
              restaurant={restaurantA}
              onVote={() => handleVote(restaurantA, restaurantB)}
              onLongPress={() => setSheetRestaurant(restaurantA)}
              prefersReducedMotion={prefersReducedMotion}
            />
            <SwipeableCard
              restaurant={restaurantB}
              onVote={() => handleVote(restaurantB, restaurantA)}
              onLongPress={() => setSheetRestaurant(restaurantB)}
              prefersReducedMotion={prefersReducedMotion}
            />
          </>
        ) : (
          <EmptyState onRetry={() => setRefreshIndex((n) => n + 1)} />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          className="h-[51px] rounded-[15px] bg-[#F7DCAD] text-[#222222] text-[20px] font-bold"
          onClick={handleUndo}
          disabled={!lastVoteId}
          aria-disabled={!lastVoteId}
        >
          Undo
        </button>
        <button
          className="h-[51px] rounded-[15px] bg-[#741B3F] text-white text-[20px] font-bold"
          onClick={handleSkip}
        >
          Skip
        </button>
      </div>

      <RestaurantSheet
        restaurant={sheetRestaurant}
        onClose={() => setSheetRestaurant(null)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function LogoHeader() {
  return (
    <div className="flex items-center justify-center">
      <Image
        src="/logos/forkfight_logo.svg"
        alt="ForkFight"
        width={246}
        height={59}
        priority
      />
    </div>
  );
}

function CategorySelector(props: {
  value: VotableCategory;
  onChange: (c: VotableCategory) => void;
}) {
  return (
    <div className="mt-2 inline-flex rounded-[10px] bg-[#f1e6ea] p-1">
      {VOTABLE_CATEGORIES.map((cat) => {
        const selected = props.value === cat;
        return (
          <button
            key={cat}
            className={[
              'px-4 h-[26px] min-w-[90px] rounded-[10px] text-[16px] transition-colors',
              selected ? 'bg-[#741B3F] text-white' : 'text-[#222222]',
            ].join(' ')}
            aria-pressed={selected}
            onClick={() => props.onChange(cat)}
          >
            {capitalize(cat)}
          </button>
        );
      })}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="relative h-[241px] rounded-[20px] overflow-hidden bg-zinc-200 animate-pulse" />
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center p-6 rounded-xl border border-zinc-200">
      <p className="text-zinc-700">No restaurants available.</p>
      <button
        className="mt-3 px-4 py-2 rounded-lg bg-[#741B3F] text-white"
        onClick={onRetry}
      >
        Try Again
      </button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center p-6 rounded-xl border border-red-200">
      <p className="text-red-700">Unable to load matchup.</p>
      <button
        className="mt-3 px-4 py-2 rounded-lg bg-[#741B3F] text-white"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

function SwipeableCard(props: {
  restaurant: Restaurant;
  onVote: () => void;
  onLongPress: () => void;
  prefersReducedMotion: boolean;
}) {
  const { restaurant, onVote, onLongPress, prefersReducedMotion } = props;
  const startX = useRef<number | null>(null);
  const lastX = useRef<number>(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const hasLongPressed = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    lastX.current = e.clientX;
    setDragging(true);
    hasLongPressed.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      hasLongPressed.current = true;
      onLongPress();
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || startX.current == null) return;
    const delta = e.clientX - startX.current;
    lastX.current = e.clientX;
    setDx(delta);
    // Cancel long-press if user is swiping
    if (Math.abs(delta) > 8 && longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerUp = () => {
    setDragging(false);
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const threshold = 80;
    if (!hasLongPressed.current && Math.abs(dx) > threshold) {
      onVote();
      setDx(0);
      return;
    }
    // snap back
    setDx(0);
  };

  const src = useMemo(() => getRestaurantImagePath(restaurant), [restaurant]);

  const style: React.CSSProperties = {
    transform: `translateX(${dx}px)`,
    transition:
      dragging || prefersReducedMotion ? 'none' : 'transform 180ms ease-out',
  };

  return (
    <div
      className="relative h-[241px] rounded-[20px] overflow-hidden bg-zinc-100 touch-pan-y select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={style}
      role="group"
      aria-label={`${restaurant.name}, ${formatDistance(restaurant.distanceMiles)}`}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 480px) 100vw, 480px"
        className="object-cover"
        priority={false}
      />
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute left-3 bottom-12 right-3">
        <p className="text-white font-bold text-[25px] leading-none truncate">
          {restaurant.name}
        </p>
      </div>
      <div className="absolute left-3 bottom-4 right-3">
        <p className="text-white text-[16px] leading-none">
          {formatDistance(restaurant.distanceMiles)}
        </p>
      </div>
    </div>
  );
}

function RestaurantSheet(props: {
  restaurant: Restaurant | null;
  onClose: () => void;
}) {
  const { restaurant, onClose } = props;
  if (!restaurant) return null;
  const src = getRestaurantImagePath(restaurant);
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`${restaurant.name} details`}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-[480px] rounded-t-2xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{restaurant.name}</h2>
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
          <p>Distance: {formatDistance(restaurant.distanceMiles)}</p>
          {restaurant.mapsUrl ? (
            <p className="mt-1">
              <a
                className="text-[#741B3F] underline"
                href={restaurant.mapsUrl}
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
// Utilities
// -----------------------------------------------------------------------------

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDistance(miles?: number) {
  if (!miles && miles !== 0) return '—';
  return `${miles.toFixed(1)} mi away`;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mql = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null),
    []
  );
  // Keep effect minimal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (!mql) return;
    const listener = () => setReduced(mql.matches);
    setReduced(mql.matches);
    mql.addEventListener?.('change', listener);
    return () => mql.removeEventListener?.('change', listener);
  }, [mql]);
  return reduced;
}

async function fetchMatchup([_key, category]: readonly [string, VotableCategory, number]) {
  const res = await fetch(`/api/matchup?category=${category}`, { cache: 'no-store' });
  const json: ApiResponse<MatchupResponse> = await res.json();
  if (!json.ok) {
    throw new Error(json.error ?? 'Failed to load matchup');
  }
  return json;
}
