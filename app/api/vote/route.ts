/**
 * POST /api/vote - Submit Restaurant Vote
 * Body: { matchupId, winnerId, loserId, category }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, VoteRequest, VoteResponse } from '@/types/api';
import type { VotableCategory } from '@/types/restaurant';
import { VOTABLE_CATEGORIES } from '@/types/restaurant';
import { submitVote } from '@/lib/votes/submit';

// Disable caching
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<VoteResponse>>> {
  try {
    // Parse request body
    const body: VoteRequest = await request.json();
    const { matchupId, winnerId, loserId, category, userId } = body as {
      matchupId?: string;
      winnerId?: string;
      loserId?: string;
      category?: VotableCategory;
      userId?: string;
    };

    // Validate required fields
    if (!matchupId || !winnerId || !loserId || !category) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required fields: matchupId, winnerId, loserId, category',
        },
        { status: 400 }
      );
    }

    // Validate category
    if (!VOTABLE_CATEGORIES.includes(category as VotableCategory)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid category. Must be one of: ${VOTABLE_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate userId format if provided
    if (userId !== undefined && typeof userId !== 'string') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid userId format',
        },
        { status: 400 }
      );
    }

    // Validate winner !== loser
    if (winnerId === loserId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Winner and loser must be different restaurants',
        },
        { status: 400 }
      );
    }

    // Submit vote
    const result = await submitVote({
      matchupId,
      winnerId,
      loserId,
      category,
      userId,
    });

    // Return voteId + updated restaurants
    return NextResponse.json({
      ok: true,
      data: {
        voteId: result.voteId ?? null,
        winner: result.winner,
        loser: result.loser,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error) {
      if (
        error.message.includes('not found') ||
        error.message.includes('different')
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          { status: 422 }
        );
      }
    }

    // Generic error
    console.error('Vote submission error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
