import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types/api';

type RegisterBody = {
	email: string;
	password: string;
};

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ userId: string }>>> {
	try {
		const body = (await request.json()) as Partial<RegisterBody>;
		const email = (body.email ?? '').trim().toLowerCase();
		const password = body.password ?? '';

		if (!email || !password) {
			return NextResponse.json(
				{ ok: false, error: 'Email and password are required' },
				{ status: 400 }
			);
		}

		// Domain restriction (keyword check)
		if (!email.includes('illinois.edu')) {
			return NextResponse.json(
				{ ok: false, error: 'Only illinois.edu emails are allowed to register' },
				{ status: 403 }
			);
		}

		const supabase = getSupabaseAdmin();
		if (!supabase) {
			return NextResponse.json(
				{ ok: false, error: 'Server auth is not configured' },
				{ status: 500 }
			);
		}

		// Create user via admin (immediately confirmed)
		const { data, error } = await supabase.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		});
		if (error) {
			return NextResponse.json(
				{ ok: false, error: error.message },
				{ status: 400 }
			);
		}

		return NextResponse.json({
			ok: true,
			data: { userId: data.user.id },
		});
	} catch (err: any) {
		return NextResponse.json(
			{ ok: false, error: err?.message ?? 'Internal server error' },
			{ status: 500 }
		);
	}
}


