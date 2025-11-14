/**
 * Phase 1 - Domain Types
 * Pure TypeScript types with no side effects, no DOM/Next.js APIs, no I/O.
 * Defines the core domain vocabulary for ForkFight restaurant rankings.
 */

// ============================================================================
// Identifiers
// ============================================================================

/**
 * Opaque identifier for a restaurant (UUID or slug).
 */
export type RestaurantId = string;

// ============================================================================
// Rating Categories
// ============================================================================

/**
 * Categories that can be voted on.
 * Note: 'overall' is NOT votable - it's calculated from all votes.
 */
export type VotableCategory = 'value' | 'aesthetics' | 'speed';

/**
 * Categories that can be used for sorting/rankings.
 * Includes 'global' (overall ELO) plus all votable categories.
 */
export type SortableCategory = 'global' | VotableCategory;

/**
 * All votable categories in canonical order.
 * Exported as readonly to prevent mutation.
 */
export const VOTABLE_CATEGORIES: readonly VotableCategory[] = [
  'value',
  'aesthetics',
  'speed',
] as const;

/**
 * All sortable categories (for rankings UI).
 */
export const SORTABLE_CATEGORIES: readonly SortableCategory[] = [
  'global',
  'value',
  'aesthetics',
  'speed',
] as const;

/**
 * @deprecated Use VotableCategory or SortableCategory instead.
 * Kept for backwards compatibility during migration.
 */
export type RatingCategory = 'overall' | VotableCategory;

/**
 * @deprecated Use VOTABLE_CATEGORIES or SORTABLE_CATEGORIES instead.
 */
export const RATING_CATEGORIES: readonly RatingCategory[] = [
  'overall',
  'value',
  'aesthetics',
  'speed',
] as const;

// ============================================================================
// Per-Category Rating State (DEPRECATED)
// ============================================================================

/**
 * @deprecated No longer used - Restaurant interface is now flat.
 * Kept for backwards compatibility during migration.
 */
export interface CategoryRatingState {
  /** Current ELO rating for this category */
  readonly rating: number;

  /** Number of completed matchups in this category (used for K-factor tuning) */
  readonly games: number;
}

// ============================================================================
// Restaurant
// ============================================================================

/**
 * Core restaurant entity with identity, presentation fields, and flat ELO ratings.
 * Ratings are stored as flat fields matching the database schema.
 * No runtime image fetching happens here.
 */
export interface Restaurant {
  /** Unique identifier (UUID) */
  readonly id: RestaurantId;

  /** Display name */
  readonly name: string;

  /** URL-safe slug (used for image paths and routing) */
  readonly slug: string;

  /** Image slug for cover photo */
  readonly imageSlug?: string;

  /** Latitude (if available) */
  readonly lat?: number;

  /** Longitude (if available) */
  readonly lng?: number;

  /** Distance from campus in miles */
  readonly distanceMiles?: number;

  /** Google Maps URL for navigation */
  readonly mapsUrl?: string;

  /** Global ELO rating (updated on every vote) */
  readonly eloGlobal: number;

  /** Value category ELO rating */
  readonly eloValue: number;

  /** Aesthetics category ELO rating */
  readonly eloAesthetics: number;

  /** Speed category ELO rating */
  readonly eloSpeed: number;
}

// ============================================================================
// Matchup
// ============================================================================

/**
 * Represents a head-to-head comparison shown to the user.
 * Independent of persistence; generated upstream.
 *
 * Constraint: a !== b
 */
export interface Matchup {
  /** Opaque identifier (generated upstream) */
  readonly id: string;

  /** Which category this matchup tests (only votable categories) */
  readonly category: VotableCategory;

  /** First restaurant ID */
  readonly a: RestaurantId;

  /** Second restaurant ID (must differ from a) */
  readonly b: RestaurantId;

  /** Creation timestamp (epoch milliseconds, for analytics) */
  readonly createdAt: number;
}

// ============================================================================
// Vote Record
// ============================================================================

/**
 * Records the user's choice for a matchup.
 * Represents the domain event of a completed vote.
 *
 * Constraints:
 * - Winner and loser must be different (no draws in current implementation)
 * - Category must be votable (value|aesthetics|speed)
 */
export interface VoteRecord {
  /** Reference to the matchup that was voted on */
  readonly matchupId: string;

  /** Category being evaluated (only votable categories) */
  readonly category: VotableCategory;

  /** Winning restaurant ID (required, no draws) */
  readonly winner: RestaurantId;

  /** Losing restaurant ID (required, no draws) */
  readonly loser: RestaurantId;

  /** Vote timestamp (epoch milliseconds) */
  readonly createdAt: number;

  /** Optional user ID for anti-gaming/auditing */
  readonly userId?: string;
}
