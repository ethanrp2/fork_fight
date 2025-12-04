/**
 * Phase 2 - Restaurant Repository
 * Data store for restaurants with Supabase integration and in-memory fallback.
 */

import type {
  Restaurant,
  RestaurantId,
} from '@/types/restaurant';
import { getSupabaseAdmin } from '@/lib/supabase';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform Supabase row to Restaurant type.
 * Maps snake_case columns to camelCase properties.
 */
function rowToRestaurant(row: any): Restaurant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageSlug: row.image_url ?? row.image_slug,
    lat: typeof row.lat === 'number' ? row.lat : (row.lat != null ? Number(row.lat) : undefined),
    lng: typeof row.lng === 'number' ? row.lng : (row.lng != null ? Number(row.lng) : undefined),
    distanceMiles: row.distance_miles != null ? Number(row.distance_miles) : undefined,
    mapsUrl: row.maps_url,
    eloGlobal: Number(row.elo_global),
    eloValue: Number(row.elo_value),
    eloAesthetics: Number(row.elo_aesthetics),
    eloSpeed: Number(row.elo_speed),
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Get all active restaurants.
 */
export async function getAllRestaurants(): Promise<Restaurant[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch restaurants: ${error.message}`);
  }

  return (data || []).map(rowToRestaurant);
}

/**
 * Get a single restaurant by ID.
 * Returns null if not found.
 */
export async function getRestaurantById(
  id: RestaurantId
): Promise<Restaurant | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Small retry for transient network failures
  let lastError: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .single();

    if (!error) {
      return rowToRestaurant(data);
    }

    if (error.code === 'PGRST116') {
      return null; // Not found
    }

    lastError = error;

    // Only retry on likely transient fetch failures
    const message = String(error?.message ?? '');
    const isTransient =
      message.includes('fetch failed') ||
      message.includes('ECONNRESET') ||
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT');

    if (!isTransient || attempt === 2) {
      break;
    }

    // brief backoff
    await new Promise((r) => setTimeout(r, 150));
  }

  throw new Error(`Failed to fetch restaurant ${id}: ${lastError?.message ?? 'unknown error'}`);
}

/**
 * Get multiple restaurants by IDs.
 * Skips IDs that don't exist.
 */
export async function getRestaurantsByIds(
  ids: readonly RestaurantId[]
): Promise<Restaurant[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .in('id', ids as string[]);

  if (error) {
    throw new Error(`Failed to fetch restaurants: ${error.message}`);
  }

  return (data || []).map(rowToRestaurant);
}

/**
 * Update restaurant ELO ratings.
 * Accepts partial ELO field updates (eloGlobal, eloValue, eloAesthetics, eloSpeed).
 *
 * @param updates - Map of restaurant ID to partial ELO updates
 */
export async function updateRestaurantRatings(
  updates: ReadonlyMap<
    RestaurantId,
    Partial<Pick<Restaurant, 'eloGlobal' | 'eloValue' | 'eloAesthetics' | 'eloSpeed'>>
  >
): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Execute all updates in parallel
  const updatePromises = Array.from(updates.entries()).map(async ([id, fields]) => {
    // Map camelCase to snake_case for database
    const dbFields: Record<string, number> = {};

    if (fields.eloGlobal !== undefined) dbFields.elo_global = fields.eloGlobal;
    if (fields.eloValue !== undefined) dbFields.elo_value = fields.eloValue;
    if (fields.eloAesthetics !== undefined) dbFields.elo_aesthetics = fields.eloAesthetics;
    if (fields.eloSpeed !== undefined) dbFields.elo_speed = fields.eloSpeed;

    const { error } = await supabase
      .from('restaurants')
      .update(dbFields)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update restaurant ${id}: ${error.message}`);
    }
  });

  await Promise.all(updatePromises);
}
