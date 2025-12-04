'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUser } from '@/lib/auth';

export default function LoginPage() {
	const router = useRouter();
	const { user, loading: authLoading } = useAuthUser();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!authLoading && user) {
			router.replace('/');
		}
	}, [authLoading, user, router]);

	if (authLoading) {
		return <div className="mx-auto max-w-[480px] py-10">Loading…</div>;
	}
	if (user) return null;

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		setSubmitting(false);
		if (error) {
			setError(error.message);
			return;
		}
		router.replace('/');
	};

	return (
		<div className="mx-auto max-w-[480px] py-10">
			<h1 className="text-[28px] font-bold mb-6">Login</h1>
			<form onSubmit={onSubmit} className="flex flex-col gap-4">
				<label className="flex flex-col gap-1">
					<span className="text-sm text-zinc-700">Email</span>
					<input
						type="email"
						required
						className="h-11 rounded-xl border border-zinc-300 px-3"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="you@illinois.edu"
						autoComplete="email"
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-sm text-zinc-700">Password</span>
					<input
						type="password"
						required
						className="h-11 rounded-xl border border-zinc-300 px-3"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="••••••••"
						autoComplete="current-password"
					/>
				</label>
				{error ? <p className="text-red-600 text-sm">{error}</p> : null}
				<button
					type="submit"
					disabled={submitting}
					className="h-11 rounded-xl bg-[#741B3F] text-white font-semibold disabled:opacity-50"
				>
					{submitting ? 'Logging in…' : 'Login'}
				</button>
			</form>
			<p className="mt-4 text-sm">
				No account?{' '}
				<Link className="text-[#741B3F] underline" href="/register">
					Register
				</Link>
			</p>
		</div>
	);
}


