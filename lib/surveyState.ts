import { useCallback, useEffect, useState } from 'react';
import type { Matchup } from '@/types/restaurant';
import type { Restaurant, VotableCategory } from '@/types/restaurant';

export interface SurveySnapshot {
  readonly matchup: Matchup;
  readonly restaurantA: Restaurant;
  readonly restaurantB: Restaurant;
  readonly category: VotableCategory;
  readonly ts: number; // epoch ms
}

const STORAGE_KEY = 'ff_survey_snapshot';
const PREV_STORAGE_KEY = 'ff_survey_prev_snapshot';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function readSnapshot(): SurveySnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurveySnapshot;
    if (!parsed?.matchup?.id || !parsed?.restaurantA?.id || !parsed?.restaurantB?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(next: SurveySnapshot | null) {
  try {
    if (!next) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore storage errors
  }
}

function readPrevSnapshot(): SurveySnapshot | null {
	try {
		const raw = sessionStorage.getItem(PREV_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SurveySnapshot;
		if (!parsed?.matchup?.id || !parsed?.restaurantA?.id || !parsed?.restaurantB?.id) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function writePrevSnapshot(next: SurveySnapshot | null) {
	try {
		if (!next) {
			sessionStorage.removeItem(PREV_STORAGE_KEY);
		} else {
			sessionStorage.setItem(PREV_STORAGE_KEY, JSON.stringify(next));
		}
	} catch {
		// ignore storage errors
	}
}

export function useSurveyState() {
  // Initialize synchronously from sessionStorage to be available on first render
  const [snapshot, setSnapshotState] = useState<SurveySnapshot | null>(readSnapshot());
	const [prevSnapshot, setPrevSnapshotState] = useState<SurveySnapshot | null>(readPrevSnapshot());

  // Load on mount
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) {
        setSnapshotState(readSnapshot());
			}
			if (e.key === PREV_STORAGE_KEY) {
				setPrevSnapshotState(readPrevSnapshot());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSnapshot = useCallback((next: SurveySnapshot) => {
    setSnapshotState(next);
    writeSnapshot(next);
  }, []);

	const setPrevSnapshot = useCallback((next: SurveySnapshot) => {
		setPrevSnapshotState(next);
		writePrevSnapshot(next);
	}, []);

  const clearSnapshot = useCallback(() => {
    setSnapshotState(null);
    writeSnapshot(null);
  }, []);

	const clearPrevSnapshot = useCallback(() => {
		setPrevSnapshotState(null);
		writePrevSnapshot(null);
	}, []);

  const isExpired = snapshot ? Date.now() - snapshot.ts > TTL_MS : false;

	return { snapshot, setSnapshot, clearSnapshot, prevSnapshot, setPrevSnapshot, clearPrevSnapshot, isExpired };
}


