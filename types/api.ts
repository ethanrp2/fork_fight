/**
 * Phase 2 - API Contract Types
 * Type definitions for API requests and responses.
 * Used by both API routes and client code.
 */

import type {
  Restaurant,
  RestaurantId,
  VotableCategory,
  SortableCategory,
  Matchup,
} from './restaurant';

// ============================================================================
// Generic API Response Wrapper
// ============================================================================

/**
 * Standard API response envelope.
 * All API routes return this structure.
 */
export interface ApiResponse<T = unknown> {
  /** Success status */
  readonly ok: boolean;

  /** Response data (present if ok=true) */
  readonly data?: T;

  /** Error message (present if ok=false) */
  readonly error?: string;
}

// ============================================================================
// GET /api/matchup - Matchup Generation
// ============================================================================

/**
 * Response from GET /api/matchup
 */
export interface MatchupResponse {
  /** The generated matchup */
  readonly matchup: Matchup;

  /** Full restaurant A details */
  readonly restaurantA: Restaurant;

  /** Full restaurant B details */
  readonly restaurantB: Restaurant;
}

// ============================================================================
// POST /api/vote - Vote Submission
// ============================================================================

/**
 * Request body for POST /api/vote
 */
export interface VoteRequest {
  /** ID of the matchup being voted on */
  readonly matchupId: string;

  /** ID of the winning restaurant */
  readonly winnerId: RestaurantId;

  /** ID of the losing restaurant */
  readonly loserId: RestaurantId;

  /** Category being evaluated (must be votable) */
  readonly category: VotableCategory;

  /** Optional user identifier (dev fallback is applied server-side if omitted) */
  readonly userId?: string;
}

/**
 * Response from POST /api/vote
 */
export interface VoteResponse {
  /** Unique vote ID for undo operations */
  readonly voteId: string;

  /** Updated winner restaurant */
  readonly winner: Restaurant;

  /** Updated loser restaurant */
  readonly loser: Restaurant;
}

// ============================================================================
// POST /api/undo - Undo Last Vote
// ============================================================================

/**
 * Request body for POST /api/undo
 */
export interface UndoRequest {
  /** ID of the vote to undo (from VoteResponse) */
  readonly voteId: string;
}

/**
 * Response from POST /api/undo
 */
export interface UndoResponse {
  /** Whether the undo was successful */
  readonly success: boolean;

  /** Restored winner restaurant (if success=true) */
  readonly winner?: Restaurant;

  /** Restored loser restaurant (if success=true) */
  readonly loser?: Restaurant;

  /** Reason why undo failed (if success=false) */
  readonly reason?: string;
}

// ============================================================================
// GET /api/restaurants - Rankings
// ============================================================================

/**
 * Simplified restaurant info for rankings display.
 */
export interface RankingEntry {
  /** Rank position (1-indexed) */
  readonly rank: number;

  /** Restaurant ID */
  readonly id: RestaurantId;

  /** Restaurant name */
  readonly name: string;

  /** Distance in miles */
  readonly distanceMiles: number;

  /** Image slug for constructing image path */
  readonly imageSlug: string;

  /** Google Maps URL (used client-side to derive coordinates) */
  readonly mapsUrl?: string;

  /** Current rating for the requested category */
  readonly rating: number;

  /** Number of games played in this category */
  readonly games: number;
}

/**
 * Response from GET /api/restaurants
 */
export interface RankingsResponse {
  /** Sorted list of restaurants with rankings */
  readonly rankings: readonly RankingEntry[];

  /** Category used for sorting (global or votable) */
  readonly category: SortableCategory;
}
