/**
 * POST /api/undo - Undo Last Vote
 * Body: { voteId }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, UndoRequest, UndoResponse } from '@/types/api';
import { undoVote } from '@/lib/votes/undo';

// Disable caching
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<UndoResponse>>> {
  try {
    // Parse request body
    const body: UndoRequest = await request.json();
    const { voteId } = body;

    // Validate required field
    if (!voteId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required field: voteId',
        },
        { status: 400 }
      );
    }

    // Undo vote
    const result = await undoVote(voteId);

    // Return result (success even if nothing to undo)
    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    // Generic error
    console.error('Undo error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
