import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import type { SortableCategory } from '@/types/restaurant';
import { getPersonalRankings } from '@/lib/personalRankings';

type Body = {
	userId: string;
	category?: SortableCategory;
};

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ rankings: any[]; category: SortableCategory }>>> {
	try {
		const body = (await request.json()) as Partial<Body>;
		const userId = (body.userId ?? '').trim();
		const category = (body.category ?? 'global') as SortableCategory;

		if (!userId) {
			return NextResponse.json(
				{ ok: false, error: 'userId is required' },
				{ status: 400 }
			);
		}

		if (!['global', 'value', 'aesthetics', 'speed'].includes(category)) {
			return NextResponse.json(
				{ ok: false, error: 'Invalid category' },
				{ status: 400 }
			);
		}

		const result = await getPersonalRankings(userId, category);
		return NextResponse.json({ ok: true, data: result });
	} catch (err: any) {
		return NextResponse.json(
			{ ok: false, error: err?.message ?? 'Internal server error' },
			{ status: 500 }
		);
	}
}


