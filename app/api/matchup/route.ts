/**
 * GET /api/matchup - Generate Restaurant Matchup
 * Query params: ?category={category}
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, MatchupResponse } from '@/types/api';
import type { VotableCategory } from '@/types/restaurant';
import { VOTABLE_CATEGORIES } from '@/types/restaurant';
import { generateMatchup, NoMatchupError } from '@/lib/matchup';
import { getRestaurantsByIds } from '@/lib/db/restaurants';

// Disable caching
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<MatchupResponse>>> {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as VotableCategory | null;

    // Validate category
    if (!category) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required query parameter: category',
        },
        { status: 400 }
      );
    }

    if (!VOTABLE_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid category. Must be one of: ${VOTABLE_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Generate matchup
    const matchup = await generateMatchup(category);

    // Fetch full restaurant details
    const [restaurantA, restaurantB] = await getRestaurantsByIds([
      matchup.a,
      matchup.b,
    ]);

    if (!restaurantA || !restaurantB) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to fetch restaurant details',
        },
        { status: 500 }
      );
    }

    // Return matchup + restaurants
    return NextResponse.json({
      ok: true,
      data: {
        matchup,
        restaurantA,
        restaurantB,
      },
    });
  } catch (error) {
    // Handle insufficient restaurants
    if (error instanceof NoMatchupError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 404 }
      );
    }

    // Generic error
    console.error('Matchup generation error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
