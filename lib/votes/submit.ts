/**
 * Phase 2 - Vote Submission Logic
 * Apply ELO updates (global + category) and persist votes.
 */

import type { Restaurant, RestaurantId, VotableCategory } from '@/types/restaurant';
import { updatePairByOutcome, type Outcome } from '@/lib/elo';
import {
  getRestaurantById,
  updateRestaurantRatings,
} from '@/lib/db/restaurants';
import { storeVote } from '@/lib/db/votes';

/**
 * Input for submitting a vote.
 */
export interface SubmitVoteInput {
  readonly matchupId: string;
  readonly winnerId: RestaurantId;
  readonly loserId: RestaurantId;
  readonly category: VotableCategory;
  readonly userId?: string;
}

/**
 * Result of submitting a vote.
 */
export interface SubmitVoteResult {
  readonly voteId: string;
  readonly winner: Restaurant;
  readonly loser: Restaurant;
}

/**
 * Submit a vote and update restaurant ratings.
 *
 * Steps:
 * 1. Validate inputs (winner !== loser, both exist)
 * 2. Fetch current restaurant states
 * 3. Apply ELO update TWICE: once for global, once for category
 * 4. Update restaurant ratings in repository (4 fields per restaurant)
 * 5. Store vote record with all 4 deltas for undo
 * 6. Return voteId and updated restaurants
 *
 * @param input - Vote submission data
 * @returns Vote ID and updated restaurants
 * @throws Error if validation fails or restaurants not found
 */
export async function submitVote(
  input: SubmitVoteInput
): Promise<SubmitVoteResult> {
  const { matchupId, winnerId, loserId, category, userId } = input;

  // Validate: winner !== loser
  if (winnerId === loserId) {
    throw new Error('Winner and loser must be different restaurants');
  }

  // Validate: draw not supported yet
  if (!winnerId || !loserId) {
    throw new Error('Draw support not implemented yet (winner and loser required)');
  }

  // Fetch current restaurant states
  const [winner, loser] = await Promise.all([
    getRestaurantById(winnerId),
    getRestaurantById(loserId),
  ]);

  if (!winner) {
    throw new Error(`Winner restaurant ${winnerId} not found`);
  }

  if (!loser) {
    throw new Error(`Loser restaurant ${loserId} not found`);
  }

  // Apply ELO update for GLOBAL rating
  const outcome: Outcome = 'A'; // Winner is always 'A'
  const {
    newA: newGlobalWinner,
    newB: newGlobalLoser,
    deltaA: deltaGlobalWinner,
    deltaB: deltaGlobalLoser,
  } = updatePairByOutcome({
    ratingA: winner.eloGlobal,
    ratingB: loser.eloGlobal,
    outcome,
  });

  // Apply ELO update for CATEGORY rating
  const categoryKey = `elo${category.charAt(0).toUpperCase()}${category.slice(1)}` as
    | 'eloValue'
    | 'eloAesthetics'
    | 'eloSpeed';

  const {
    newA: newCatWinner,
    newB: newCatLoser,
    deltaA: deltaCatWinner,
    deltaB: deltaCatLoser,
  } = updatePairByOutcome({
    ratingA: winner[categoryKey],
    ratingB: loser[categoryKey],
    outcome,
  });

  // Build updated restaurant objects
  const updatedWinner: Restaurant = {
    ...winner,
    eloGlobal: newGlobalWinner,
    [categoryKey]: newCatWinner,
  };

  const updatedLoser: Restaurant = {
    ...loser,
    eloGlobal: newGlobalLoser,
    [categoryKey]: newCatLoser,
  };

  // Update restaurants in repository (both global + category)
  const updates = new Map();
  updates.set(winnerId, {
    eloGlobal: newGlobalWinner,
    [categoryKey]: newCatWinner,
  });
  updates.set(loserId, {
    eloGlobal: newGlobalLoser,
    [categoryKey]: newCatLoser,
  });

  await updateRestaurantRatings(updates);

  // Store vote with all 4 deltas (global + category for winner/loser)
  const voteId = await storeVote(
    winnerId,
    loserId,
    category,
    deltaGlobalWinner,
    deltaGlobalLoser,
    deltaCatWinner,
    deltaCatLoser,
    userId
  );

  return {
    voteId,
    winner: updatedWinner,
    loser: updatedLoser,
  };
}
