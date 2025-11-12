/**
 * Phase 2 - Vote Repository
 * Vote history with delta storage for stateless undo.
 * Uses Supabase with in-memory fallback.
 */

import type { VoteRecord, RestaurantId, VotableCategory } from '@/types/restaurant';
import { getSupabaseAdmin } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

/**
 * Vote record with stored deltas for exact undo.
 * Stores 4 deltas: global + category for both winner and loser.
 */
export interface VoteWithDeltas {
  readonly voteId: string;
  readonly winnerId: RestaurantId;
  readonly loserId: RestaurantId;
  readonly category: VotableCategory;
  readonly deltaGlobalWinner: number;
  readonly deltaGlobalLoser: number;
  readonly deltaCatWinner: number;
  readonly deltaCatLoser: number;
  readonly undone: boolean;
  readonly createdAt: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform Supabase row to VoteWithDeltas type.
 * Maps snake_case columns to camelCase properties.
 */
function rowToVoteWithDeltas(row: any): VoteWithDeltas {
  return {
    voteId: row.id,
    winnerId: row.winner_id,
    loserId: row.loser_id,
    category: row.category as VotableCategory,
    deltaGlobalWinner: Number(row.delta_global_winner),
    deltaGlobalLoser: Number(row.delta_global_loser),
    deltaCatWinner: Number(row.delta_cat_winner),
    deltaCatLoser: Number(row.delta_cat_loser),
    undone: row.undone,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Store a vote with its deltas.
 * Returns the generated vote ID.
 *
 * @param winnerId - Winner restaurant ID
 * @param loserId - Loser restaurant ID
 * @param category - Vote category
 * @param deltaGlobalWinner - Global ELO delta for winner
 * @param deltaGlobalLoser - Global ELO delta for loser
 * @param deltaCatWinner - Category ELO delta for winner
 * @param deltaCatLoser - Category ELO delta for loser
 * @param userId - Optional user ID
 * @returns Vote ID (UUID)
 */
export async function storeVote(
  winnerId: RestaurantId,
  loserId: RestaurantId,
  category: VotableCategory,
  deltaGlobalWinner: number,
  deltaGlobalLoser: number,
  deltaCatWinner: number,
  deltaCatLoser: number,
  userId?: string
): Promise<string> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('votes')
    .insert({
      user_id: userId,
      winner_id: winnerId,
      loser_id: loserId,
      category,
      delta_global_winner: deltaGlobalWinner,
      delta_global_loser: deltaGlobalLoser,
      delta_cat_winner: deltaCatWinner,
      delta_cat_loser: deltaCatLoser,
      undone: false,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to store vote: ${error.message}`);
  }

  return data.id;
}

/**
 * Get a vote by ID.
 * Returns null if not found.
 *
 * @param voteId - Vote ID to lookup
 * @returns Vote with deltas, or null if not found
 */
export async function getVoteById(
  voteId: string
): Promise<VoteWithDeltas | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('id', voteId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch vote: ${error.message}`);
  }

  return rowToVoteWithDeltas(data);
}

/**
 * Mark a vote as undone.
 * Does not delete the vote (audit trail).
 *
 * @param voteId - Vote ID to mark as undone
 */
export async function markVoteUndone(voteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('votes')
    .update({ undone: true })
    .eq('id', voteId);

  if (error) {
    throw new Error(`Failed to mark vote as undone: ${error.message}`);
  }
}
