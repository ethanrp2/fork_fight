/**
 * GET /api/restaurants - Get Restaurant Rankings
 * Query params: ?category={category}
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, RankingsResponse, RankingEntry } from '@/types/api';
import type { SortableCategory } from '@/types/restaurant';
import { SORTABLE_CATEGORIES } from '@/types/restaurant';
import { getRankings } from '@/lib/rankings';

// Disable caching
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<RankingsResponse>>> {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get('category') || 'global') as SortableCategory;

    // Validate category
    if (!SORTABLE_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid category. Must be one of: ${SORTABLE_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Fetch rankings
    const sorted = await getRankings(category);

    // Determine which ELO field to read
    let ratingKey: keyof typeof sorted[0];
    if (category === 'global') {
      ratingKey = 'eloGlobal';
    } else {
      ratingKey = `elo${category.charAt(0).toUpperCase()}${category.slice(1)}` as keyof typeof sorted[0];
    }

    // Map to ranking entries with rank numbers
    const rankings: RankingEntry[] = sorted.map((restaurant, index) => ({
      rank: index + 1,
      id: restaurant.id,
      name: restaurant.name,
      distanceMiles: restaurant.distanceMiles || 0,
      imageSlug: restaurant.imageSlug || restaurant.slug,
      mapsUrl: restaurant.mapsUrl,
      rating: restaurant[ratingKey] as number,
      games: 0, // No longer tracked
    }));

    // Return rankings
    return NextResponse.json({
      ok: true,
      data: {
        rankings,
        category,
      },
    });
  } catch (error) {
    // Generic error
    console.error('Rankings error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
