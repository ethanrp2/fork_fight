/**
 * Phase 2 - Rankings Logic
 * Fetch and sort restaurants by rating category.
 */

import type { Restaurant, SortableCategory } from '@/types/restaurant';
import { getAllRestaurants } from '@/lib/db/restaurants';

/**
 * Get restaurant rankings for a specific category.
 * Sorts by ELO rating DESC.
 *
 * @param category - Category to sort by ('global' | 'value' | 'aesthetics' | 'speed')
 * @returns Sorted array of restaurants (client adds rank numbers)
 */
export async function getRankings(
  category: SortableCategory
): Promise<Restaurant[]> {
  // Fetch all restaurants
  const restaurants = await getAllRestaurants();

  // Determine which ELO field to sort by
  let sortKey: keyof Restaurant;
  if (category === 'global') {
    sortKey = 'eloGlobal';
  } else {
    // Convert 'value' → 'eloValue', 'aesthetics' → 'eloAesthetics', etc.
    sortKey = `elo${category.charAt(0).toUpperCase()}${category.slice(1)}` as keyof Restaurant;
  }

  // Sort by ELO rating descending
  const sorted = restaurants.sort((a, b) => {
    const ratingA = a[sortKey] as number;
    const ratingB = b[sortKey] as number;
    return ratingB - ratingA;
  });

  return sorted;
}
