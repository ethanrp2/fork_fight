'use client';

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton browser client with session persistence
export const supabase = createClient(url, anon, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
	},
});


