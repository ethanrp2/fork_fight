/**
 * Phase 1 - Pure ELO Math
 * Referentially transparent functions for ELO rating calculations.
 * No side effects, no I/O, no DOM/Next.js APIs.
 *
 * Formula:
 * - Expected score: E_A = 1 / (1 + 10^((R_B - R_A)/400))
 * - Update: R_A' = R_A + K * (S_A - E_A)
 * - K-factor: Fixed at 32 (no game count tracking)
 */

import type { VotableCategory } from '@/types/restaurant';

// ============================================================================
// Types
// ============================================================================

/**
 * Outcome of a matchup from player A's perspective.
 */
export type Outcome = 'A' | 'B' | 'draw';

/**
 * Input for updatePairByOutcome function.
 */
export interface UpdatePairInput {
  readonly ratingA: number;
  readonly ratingB: number;
  readonly outcome: Outcome;
}

/**
 * Output of updatePairByOutcome function.
 */
export interface UpdatePairOutput {
  readonly newA: number;
  readonly newB: number;
  readonly deltaA: number;
  readonly deltaB: number;
}

// ============================================================================
// Core ELO Functions
// ============================================================================

/**
 * Calculate expected score for player A against player B.
 *
 * @param ratingA - Player A's current ELO rating
 * @param ratingB - Player B's current ELO rating
 * @returns Expected score in [0, 1] where 0.5 = 50% chance
 * @throws Error if inputs are NaN
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  if (Number.isNaN(ratingA) || Number.isNaN(ratingB)) {
    throw new Error('ELO ratings cannot be NaN');
  }

  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * K-factor for ELO calculations.
 * Fixed at 32 for all restaurants (no game count progression).
 */
export const K_FACTOR = 32;

/**
 * Update both players' ratings based on matchup outcome.
 * Uses fixed K-factor of 32 for all calculations.
 *
 * @param input - Ratings and outcome
 * @returns New ratings for both players (immutable)
 * @throws Error if ratings are NaN or outcome is invalid
 */
export function updatePairByOutcome(
  input: UpdatePairInput
): UpdatePairOutput {
  const { ratingA, ratingB, outcome } = input;

  // Validate inputs
  if (Number.isNaN(ratingA) || Number.isNaN(ratingB)) {
    throw new Error('ELO ratings cannot be NaN');
  }

  // Calculate expected scores
  const E_A = expectedScore(ratingA, ratingB);
  const E_B = 1 - E_A;

  // Map outcome to actual scores
  let S_A: number;
  let S_B: number;

  switch (outcome) {
    case 'A':
      S_A = 1;
      S_B = 0;
      break;
    case 'B':
      S_A = 0;
      S_B = 1;
      break;
    case 'draw':
      S_A = 0.5;
      S_B = 0.5;
      break;
    default:
      // Exhaustive check
      const _exhaustive: never = outcome;
      throw new Error(`Invalid outcome: ${_exhaustive}`);
  }

  // Calculate deltas using fixed K-factor
  const deltaA = K_FACTOR * (S_A - E_A);
  const deltaB = K_FACTOR * (S_B - E_B);

  // Update ratings
  const newA = ratingA + deltaA;
  const newB = ratingB + deltaB;

  return { newA, newB, deltaA, deltaB };
}


/**
 * Calculate the probability of an upset (weaker player winning).
 * Returns the minimum expected score, representing upset likelihood.
 *
 * @param rA - Player A's rating
 * @param rB - Player B's rating
 * @returns Upset probability in [0, 0.5]
 */
export function predictUpsetProbability(rA: number, rB: number): number {
  const E_A = expectedScore(rA, rB);
  return Math.min(E_A, 1 - E_A);
}
