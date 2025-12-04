import type { Restaurant, SortableCategory, VotableCategory } from '@/types/restaurant';
import type { RankingEntry } from '@/types/api';
import { getAllRestaurants } from '@/lib/db/restaurants';
import { getVotesByUser } from '@/lib/db/votes';
import { updatePairByOutcome } from '@/lib/elo';

type Category = SortableCategory; // 'global' | 'value' | 'aesthetics' | 'speed'

export async function getPersonalRankings(
	userId: string,
	category: Category
): Promise<{ rankings: RankingEntry[]; category: Category }> {
	const restaurants = await getAllRestaurants();
	const votes = await getVotesByUser(userId);

	// Initialize per-restaurant rating map at 1500
	const ratingById = new Map<string, number>();
	for (const r of restaurants) {
		ratingById.set(r.id, 1500);
	}

	// Decide which votes to include
	const relevantVotes = category === 'global'
		? votes
		: votes.filter(v => v.category === (category as VotableCategory));

	// Replay votes in chronological order
	for (const v of relevantVotes) {
		const a = ratingById.get(v.winnerId) ?? 1500;
		const b = ratingById.get(v.loserId) ?? 1500;
		const { newA, newB } = updatePairByOutcome({ ratingA: a, ratingB: b, outcome: 'A' });
		ratingById.set(v.winnerId, newA);
		ratingById.set(v.loserId, newB);
	}

	// Sort restaurants by computed rating desc
	const sorted = [...restaurants].sort((ra, rb) => {
		const a = ratingById.get(ra.id) ?? 1500;
		const b = ratingById.get(rb.id) ?? 1500;
		return b - a;
	});

	// Map to RankingEntry
	const rankings: RankingEntry[] = sorted.map((r, idx) => {
		const rating = ratingById.get(r.id) ?? 1500;
		return {
			rank: idx + 1,
			id: r.id,
			name: r.name,
			distanceMiles: (r as any).distanceMiles,
			lat: (r as any).lat,
			lng: (r as any).lng,
			imageSlug: r.imageSlug || r.slug,
			mapsUrl: r.mapsUrl,
			rating,
			games: 0,
		};
	});

	return { rankings, category };
}


