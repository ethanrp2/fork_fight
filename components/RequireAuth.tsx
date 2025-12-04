'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '@/lib/auth';

export default function RequireAuth(props: { children: React.ReactNode }) {
	const { user, loading } = useAuthUser();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !user) {
			router.replace('/login');
		}
	}, [loading, user, router]);

	if (loading) {
		return <div className="py-10 text-center text-zinc-600">Loading…</div>;
	}
	if (!user) return null;
	return <>{props.children}</>;
}


