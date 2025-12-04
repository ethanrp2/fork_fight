'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export function useAuthUser() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let isMounted = true;
		(async () => {
			const { data } = await supabase.auth.getUser();
			if (!isMounted) return;
			setUser(data.user ?? null);
			setLoading(false);
		})();
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
		});
		return () => {
			isMounted = false;
			sub.subscription.unsubscribe();
		};
	}, []);

	return { user, loading };
}


