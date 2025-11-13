/**
 * Phase 1 - Image Path Helpers
 * Pure functions for computing expected image paths for restaurant cards.
 * No filesystem access, no Next.js imports, pure string manipulation.
 *
 * Convention:
 * - Images live under `public/restaurants/`
 * - Preferred formats: .webp, .jpg, .png (in that order)
 * - Primary key is `restaurant.imageSlug` if set
 * - Otherwise use `slug` → `public/restaurants/{slug}.{ext}`
 */

import type { Restaurant } from '@/types/restaurant';

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal restaurant interface for image path computation.
 */
type RestaurantImageInfo = Pick<Restaurant, 'slug' | 'imageSlug'>;

// ============================================================================
// Image Path Functions
// ============================================================================

/**
 * Check if a string is an absolute URL (http:// or https://).
 *
 * @param path - Path or URL string
 * @returns true if absolute URL, false otherwise
 */
function isAbsoluteUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

/**
 * Get the expected image path for a restaurant card.
 * Returns the best-guess path without touching the filesystem.
 *
 * Priority:
 * 1. If imageSlug is absolute URL → return as-is
 * 2. If imageSlug is relative path → return as-is
 * 3. Otherwise → return `/restaurants/{slug}.webp` (preferred format)
 *
 * @param restaurant - Restaurant with slug and optional imageSlug
 * @returns Image path or URL
 */
export function getRestaurantImagePath(
  restaurant: RestaurantImageInfo
): string {
  const { imageSlug, slug } = restaurant;

  // If imageSlug is explicitly set, use it
  if (imageSlug) {
    // Absolute URL → return as-is
    if (isAbsoluteUrl(imageSlug)) {
      return imageSlug;
    }

    // Relative path → normalize to start with leading slash for Next/Image
    return imageSlug.startsWith('/') ? imageSlug : `/${imageSlug}`;
  }

  // Default: use slug with .webp (preferred format)
  return `/restaurants/${slug}.webp`;
}

/**
 * Get all candidate image paths for a restaurant in priority order.
 * Useful for fallback logic (try .webp, then .jpg, then .png).
 *
 * @param restaurant - Restaurant with slug and optional imageSlug
 * @returns Readonly array of candidate paths in priority order
 */
export function getRestaurantImageCandidates(
  restaurant: RestaurantImageInfo
): readonly string[] {
  const { imageSlug, slug } = restaurant;

  // If imageSlug is set, it's the only candidate
  if (imageSlug) {
    return [imageSlug];
  }

  // Otherwise, return all format candidates in order of preference
  return [
    `/restaurants/${slug}.webp`,
    `/restaurants/${slug}.jpg`,
    `/restaurants/${slug}.png`,
  ];
}
