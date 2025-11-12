/**
 * Phase 2 - Undo Vote Logic
 * Reverse rating changes using stored deltas (stateless).
 * Reverses BOTH global and category deltas.
 */

import type { Restaurant, RestaurantId, VotableCategory } from '@/types/restaurant';
import {
  getRestaurantById,
  updateRestaurantRatings,
} from '@/lib/db/restaurants';
import { getVoteById, markVoteUndone } from '@/lib/db/votes';

/**
 * Result of undo operation.
 */
export interface UndoVoteResult {
  readonly success: boolean;
  readonly winner?: Restaurant;
  readonly loser?: Restaurant;
  readonly reason?: string;
}

/**
 * Undo a vote by reversing its exact deltas.
 *
 * Steps:
 * 1. Fetch vote + all 4 deltas (global + category for winner/loser)
 * 2. Return failure if not found or already undone
 * 3. Fetch current restaurant states
 * 4. Reverse deltas: subtract all 4 deltas from current values
 * 5. Update restaurants in repository
 * 6. Mark vote as undone
 * 7. Return restored restaurants
 *
 * @param voteId - Vote ID to undo (from submitVote response)
 * @returns Success status and restored restaurants
 */
export async function undoVote(voteId: string): Promise<UndoVoteResult> {
  // Fetch vote + deltas
  const voteData = await getVoteById(voteId);

  if (!voteData) {
    return {
      success: false,
      reason: 'Vote not found',
    };
  }

  if (voteData.undone) {
    return {
      success: false,
      reason: 'Vote already undone',
    };
  }

  const {
    winnerId,
    loserId,
    category,
    deltaGlobalWinner,
    deltaGlobalLoser,
    deltaCatWinner,
    deltaCatLoser,
  } = voteData;

  // Fetch current restaurant states
  const [winner, loser] = await Promise.all([
    getRestaurantById(winnerId),
    getRestaurantById(loserId),
  ]);

  if (!winner || !loser) {
    return {
      success: false,
      reason: 'Restaurant(s) not found',
    };
  }

  // Compute category key
  const categoryKey = `elo${category.charAt(0).toUpperCase()}${category.slice(1)}` as
    | 'eloValue'
    | 'eloAesthetics'
    | 'eloSpeed';

  // Reverse all 4 deltas
  const restoredWinnerGlobal = winner.eloGlobal - deltaGlobalWinner;
  const restoredWinnerCat = winner[categoryKey] - deltaCatWinner;

  const restoredLoserGlobal = loser.eloGlobal - deltaGlobalLoser;
  const restoredLoserCat = loser[categoryKey] - deltaCatLoser;

  // Update restaurants (both global + category)
  const updates = new Map();
  updates.set(winnerId, {
    eloGlobal: restoredWinnerGlobal,
    [categoryKey]: restoredWinnerCat,
  });
  updates.set(loserId, {
    eloGlobal: restoredLoserGlobal,
    [categoryKey]: restoredLoserCat,
  });

  await updateRestaurantRatings(updates);

  // Mark vote as undone
  await markVoteUndone(voteId);

  // Fetch restored states
  const [restoredWinner, restoredLoser] = await Promise.all([
    getRestaurantById(winnerId),
    getRestaurantById(loserId),
  ]);

  return {
    success: true,
    winner: restoredWinner!,
    loser: restoredLoser!,
  };
}
