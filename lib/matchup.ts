/**
 * Phase 2 - Matchup Generation
 * Generate random restaurant pairings for voting.
 */

import type { Matchup, VotableCategory } from '@/types/restaurant';
import { getAllRestaurants } from '@/lib/db/restaurants';

/**
 * Error thrown when insufficient restaurants exist for matchups.
 */
export class NoMatchupError extends Error {
  constructor(message: string = 'Not enough restaurants for matchup') {
    super(message);
    this.name = 'NoMatchupError';
  }
}

/**
 * Generate a random matchup between two distinct restaurants.
 *
 * @param category - Votable category for this matchup
 * @returns Matchup object with restaurant IDs and metadata
 * @throws NoMatchupError if fewer than 2 restaurants available
 */
export async function generateMatchup(category: VotableCategory): Promise<Matchup> {
  // Fetch all restaurants
  const restaurants = await getAllRestaurants();

  // Validate we have enough restaurants
  if (restaurants.length < 2) {
    throw new NoMatchupError(
      `Need at least 2 restaurants, found ${restaurants.length}`
    );
  }

  // Select two distinct random indices
  const indexA = Math.floor(Math.random() * restaurants.length);
  let indexB = Math.floor(Math.random() * restaurants.length);

  // Ensure B is different from A
  while (indexB === indexA) {
    indexB = Math.floor(Math.random() * restaurants.length);
  }

  const restaurantA = restaurants[indexA];
  const restaurantB = restaurants[indexB];

  // Generate matchup
  const matchup: Matchup = {
    id: crypto.randomUUID(),
    category,
    a: restaurantA.id,
    b: restaurantB.id,
    createdAt: Date.now(),
  };

  return matchup;
}
