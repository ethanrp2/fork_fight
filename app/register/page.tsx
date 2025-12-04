'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUser } from '@/lib/auth';

export default function RegisterPage() {
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
		try {
			// Call secure API to enforce domain restriction
			const res = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			});
			const json = await res.json();
			if (!json.ok) {
				throw new Error(json.error || 'Registration failed');
			}
			// Sign in after successful creation
			const { error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) {
				throw error;
			}
			router.replace('/');
		} catch (err: any) {
			setError(err?.message ?? 'Registration failed');
		} finally {
			setSubmitting(false);
		}
	};

	const emailHint = email && !email.toLowerCase().includes('illinois.edu') ? (
		<p className="text-[12px] text-amber-700">Only illinois.edu emails can register.</p>
	) : null;

	return (
		<div className="mx-auto max-w-[480px] py-10">
			<h1 className="text-[28px] font-bold mb-6">Register</h1>
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
					{emailHint}
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-sm text-zinc-700">Password</span>
					<input
						type="password"
						required
						className="h-11 rounded-xl border border-zinc-300 px-3"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Choose a strong password"
						autoComplete="new-password"
						minLength={6}
					/>
				</label>
				{error ? <p className="text-red-600 text-sm">{error}</p> : null}
				<button
					type="submit"
					disabled={submitting}
					className="h-11 rounded-xl bg-[#741B3F] text-white font-semibold disabled:opacity-50"
				>
					{submitting ? 'Registering…' : 'Register'}
				</button>
			</form>
			<p className="mt-4 text-sm">
				Already have an account?{' '}
				<Link className="text-[#741B3F] underline" href="/login">
					Login
				</Link>
			</p>
		</div>
	);
}


