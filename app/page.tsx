'use client';

import Image from 'next/image';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApiResponse,
  MatchupResponse,
  UndoResponse,
  VoteResponse,
} from '@/types/api';
import type { Restaurant, VotableCategory } from '@/types/restaurant';
import { VOTABLE_CATEGORIES } from '@/types/restaurant';
import { getRestaurantImagePath } from '@/lib/image';
import { haversineMiles, parseLatLngFromMapsUrl, useUserLocation } from '@/lib/geo';
import { useStickyState } from '../lib/stickyState';
import { useSurveyState } from '@/lib/surveyState';

type CardSide = 'A' | 'B';

export default function Home() {
  const [category, setCategory] = useStickyState<VotableCategory>('ff_survey_category', 'value');
  const [refreshIndex, setRefreshIndex] = useStickyState<number>('ff_survey_refresh', 0);
  const [lastVoteId, setLastVoteId] = useStickyState<string | null>('ff_survey_lastVoteId', null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { coords, requestLocation, clearLocation } = useUserLocation();
	const { snapshot, setSnapshot, clearSnapshot, prevSnapshot, setPrevSnapshot, clearPrevSnapshot, isExpired } = useSurveyState();

  const fallbackData: ApiResponse<MatchupResponse> | undefined = useMemo(() => {
    if (!snapshot || isExpired) return undefined;
    return {
      ok: true,
      data: {
        matchup: snapshot.matchup,
        restaurantA: snapshot.restaurantA,
        restaurantB: snapshot.restaurantB,
      },
    };
  }, [snapshot, isExpired]);

  const { data, isLoading, error, mutate } = useSWR(
    ['matchup', refreshIndex] as const,
    fetchMatchup,
    {
      fallbackData,
      revalidateOnMount: !fallbackData,
    }
  );

  const matchup = data?.data?.matchup;
  const restaurantA = data?.data?.restaurantA;
  const restaurantB = data?.data?.restaurantB;

  // Persist snapshot when data changes
  useEffect(() => {
    if (matchup && restaurantA && restaurantB) {
      if (!snapshot || snapshot.matchup.id !== matchup.id) {
				// rotate previous snapshot for undo
				if (snapshot) {
					setPrevSnapshot(snapshot);
				}
        setSnapshot({
          matchup,
          restaurantA,
          restaurantB,
          category,
          ts: Date.now(),
        });
      }
    }
	}, [matchup, restaurantA, restaurantB, setSnapshot, setPrevSnapshot, snapshot, category]);

  const onCategoryChange = useCallback((newCat: VotableCategory) => {
    setCategory(newCat);
    // Keep current matchup pair when switching category
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
    setRefreshIndex((n: number) => n + 1);
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
		// Restore previous matchup so user can re-vote
		if (prevSnapshot) {
			const prevData: ApiResponse<MatchupResponse> = {
				ok: true,
				data: {
					matchup: prevSnapshot.matchup,
					restaurantA: prevSnapshot.restaurantA,
					restaurantB: prevSnapshot.restaurantB,
				},
			};
			// Update SWR cache without revalidating to immediately show previous matchup
			await mutate(prevData, false);
			// Set current snapshot back and clear previous
			setSnapshot(prevSnapshot);
			clearPrevSnapshot();
		}
		setLastVoteId(null);
	}, [lastVoteId, prevSnapshot, mutate, setSnapshot, clearPrevSnapshot]);

  const [sheetRestaurant, setSheetRestaurant] = useState<Restaurant | null>(
    null
  );

  return (
    <div className="flex flex-col h-[calc(100svh-80px-env(safe-area-inset-top))] min-h-0">
      <div className="pt-6 shrink-0">
        <LogoHeader />
      </div>

      <div className="mt-3 shrink-0">
        <p className="text-[#222222] text-[16px] font-normal">Currently Ranking Based On:</p>
        <div className="flex items-center gap-2 mt-2">
          <CategorySelector
            value={category}
            onChange={onCategoryChange}
          />
          <button
            className="px-3 h-[26px] rounded-[10px] bg-[#741B3F] text-white text-[14px] shrink-0"
            onClick={() => coords ? clearLocation() : requestLocation()}
          >
            {coords ? 'Disable Location' : 'Use my location'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex-1 flex flex-col gap-5 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-5 flex-1">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <ErrorState onRetry={() => setRefreshIndex((n: number) => n + 1)} />
          </div>
        ) : restaurantA && restaurantB && matchup ? (
          <div className="flex flex-col gap-5 flex-1 min-h-0">
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
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState onRetry={() => setRefreshIndex((n: number) => n + 1)} />
          </div>
        )}
      </div>

      <div className="mt-6 mb-4 grid grid-cols-2 gap-3 shrink-0">
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

      {useHasMounted() ? (
        <RestaurantSheet
          restaurant={sheetRestaurant}
          onClose={() => setSheetRestaurant(null)}
        />
      ) : null}
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
  const { coords } = useUserLocation();
  const distance = useMemo(() => {
    if (coords) {
      if (typeof (restaurant as any).lat === 'number' && typeof (restaurant as any).lng === 'number') {
        return haversineMiles(coords, { lat: (restaurant as any).lat, lng: (restaurant as any).lng });
      }
      if (restaurant.mapsUrl) {
        const ll = parseLatLngFromMapsUrl(restaurant.mapsUrl);
        if (ll) return haversineMiles(coords, ll);
      }
    }
    return restaurant.distanceMiles;
  }, [coords, restaurant]);

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
      aria-label={`${restaurant.name}, ${formatDistance(distance)}`}
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
        <p className="text-white text-[16px] font-normal leading-none">
          {formatDistance(distance)}
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
  const { coords } = useUserLocation();
  const dynamicMiles = useMemo(() => {
    if (coords && restaurant) {
      if (typeof (restaurant as any).lat === 'number' && typeof (restaurant as any).lng === 'number') {
        return haversineMiles(coords, { lat: (restaurant as any).lat, lng: (restaurant as any).lng });
      }
      if (restaurant.mapsUrl) {
        const ll = parseLatLngFromMapsUrl(restaurant.mapsUrl);
        if (ll) return haversineMiles(coords, ll);
      }
    }
    return restaurant?.distanceMiles;
  }, [coords, restaurant]);
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
          <p>Distance: {formatDistance(dynamicMiles)}</p>
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
  const mql = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null),
    []
  );
  useEffect(() => {
    if (!mql) return;
    const listener = () => setReduced(mql.matches);
    setReduced(mql.matches);
    mql.addEventListener?.('change', listener);
    return () => mql.removeEventListener?.('change', listener);
  }, [mql]);
  return reduced;
}

function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

async function fetchMatchup([_key, _refreshIndex]: readonly [string, number]) {
  // Read current survey category from sessionStorage to decide which category to fetch
  let cat = 'value';
  try {
    const raw = sessionStorage.getItem('ff_survey_category');
    if (raw != null) {
      const parsed = JSON.parse(raw) as string;
      if (parsed === 'value' || parsed === 'aesthetics' || parsed === 'speed') {
        cat = parsed;
      }
    }
  } catch {
    // ignore
  }
  const res = await fetch(`/api/matchup?category=${cat}`, { cache: 'no-store' });
  const json: ApiResponse<MatchupResponse> = await res.json();
  if (!json.ok) {
    throw new Error(json.error ?? 'Failed to load matchup');
  }
  return json;
}
