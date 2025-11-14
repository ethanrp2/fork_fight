# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ForkFight** is a swipe-style restaurant ranking app for UIUC using ELO rating system. Users vote on restaurant matchups across three categories (value, aesthetics, speed), and each vote updates both a global ELO and the category-specific ELO.

**Tech Stack:**
- Next.js 16.0.1 (App Router with Turbopack)
- React 19.2.0
- TypeScript 5 (strict mode)
- Tailwind CSS v4
- Supabase (PostgreSQL with @supabase/supabase-js v2.81.1)
- SWR for data fetching

## Development Commands

```bash
# Start dev server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Run production server
npm run start

# Lint code
npm run lint
```

**Environment Setup:**
- Copy `.env.local` with Supabase credentials:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never in client bundles)

## Architecture Overview

### Three-Phase Design Pattern

The codebase follows a strict **3-phase layered architecture** documented in code comments:

**Phase 1 - Pure Domain Logic** (`lib/elo.ts`, `lib/image.ts`, `types/restaurant.ts`)
- Pure TypeScript functions with no side effects
- No I/O, no DOM/Next.js APIs, no database calls
- Referentially transparent ELO calculations with fixed K=32
- Domain vocabulary and type definitions

**Phase 2 - Data Access & Business Logic** (`lib/db/*.ts`, `lib/votes/*.ts`, `lib/rankings.ts`)
- Repository pattern for database operations with Supabase
- Domain logic that orchestrates repositories and ELO math
- All async, uses Phase 1 functions but adds I/O
- API contract types (`types/api.ts`)

**Phase 3 - API Routes** (`app/api/*/route.ts`)
- Thin wrappers around Phase 2 functions
- Input validation and error handling
- Standard `ApiResponse<T>` envelope: `{ ok: boolean, data?: T, error?: string }`
- Routes opt out of caching with `export const dynamic = 'force-dynamic'`

### Key Architectural Principles

**Flat ELO Storage (No Nesting):**
```typescript
// Restaurant interface is flat, matching DB columns exactly
interface Restaurant {
  id: string;
  name: string;
  slug: string;
  eloGlobal: number;      // Updated on every vote
  eloValue: number;       // Updated when voting on 'value'
  eloAesthetics: number;  // Updated when voting on 'aesthetics'
  eloSpeed: number;       // Updated when voting on 'speed'
  // ... other fields
}
```

**Dual ELO Updates:**
Every vote updates TWO ratings:
1. **Global ELO** (`eloGlobal`) - always updated regardless of category
2. **Category ELO** (`eloValue | eloAesthetics | eloSpeed`) - for the voted category

This is implemented in `lib/votes/submit.ts` by calling `updatePairByOutcome()` twice.

**No Games Tracking:**
- Fixed K-factor of 32 for all calculations
- No game count columns in database
- No K-factor progression (was 40→24→16, now just 32)

**Stateless Undo:**
- Vote records store 4 deltas: `delta_global_winner`, `delta_global_loser`, `delta_cat_winner`, `delta_cat_loser`
- Undo subtracts exact deltas from current ratings
- Client provides `voteId` to undo (from vote submission response)

### Category Types

**Critical distinction between votable and sortable categories:**

```typescript
// Only these 3 can be voted on (never 'overall' or 'global')
type VotableCategory = 'value' | 'aesthetics' | 'speed';

// Can sort/rank by global or any votable category
type SortableCategory = 'global' | VotableCategory;
```

**API endpoints must validate:**
- `/api/matchup` and `/api/vote` - accept only `VotableCategory`
- `/api/restaurants` - accepts `SortableCategory` (defaults to 'global')
- `/api/matchup` requires `?category=...`; returns 404 if fewer than 2 active restaurants exist

### Database Schema

**Restaurants Table:**
- `elo_global`, `elo_value`, `elo_aesthetics`, `elo_speed` (all NUMERIC, default 1500)
- `active` boolean (only show active restaurants)
- Snake_case columns → camelCase in domain types

**Votes Table:**
- Category constraint: `CHECK (category IN ('value', 'aesthetics', 'speed'))`
- Stores 4 deltas per vote for exact undo
- `undone` boolean (audit trail, votes never deleted)
- Index on `(user_id, created_at DESC)` for undo queries

**Numeric Coercion:**
Always coerce Supabase NUMERIC columns to number:
```typescript
eloGlobal: Number(row.elo_global)
```

### Supabase Client
- `lib/supabase.ts` exposes `getSupabaseAdmin()` and `getSupabasePublic()`.
- Repositories call `getSupabaseAdmin()` and throw `"Supabase not configured"` if credentials are missing (no in-memory fallback).

### Mobile-First UI

- Max width: 480px centered container
- iOS safe-area padding for notch/home indicator
- Fixed bottom navigation with 2 items (Survey, UIUC Favorites)
- Tailwind v4 with `@theme` inline configuration
- Geist Sans font family

## Frontend Design — Survey Module (Home)

This is the first screen customers see and is optimized for fast, repeatable voting on restaurant matchups.

### Purpose
- Present a head-to-head matchup of two restaurants.
- Let the user choose which restaurant they prefer for a given category.
- Allow quick category switching and reversible actions (Skip, Undo).

### Primary Controls
- **Category selector (segmented control)**: Label “Currently Ranking Based On:” with three options:
  - `Value` (default)
  - `Aesthetics`
  - `Speed`
- The selected pill appears with white text on magenta background `#741B3F`. Unselected pills are neutral with clear affordance.
- Changing the category immediately fetches a new matchup for that category.

### Card Layout
- Two large image cards stacked vertically, each:
  - 20px radius corners, full-bleed image, subtle dark overlay for legibility
  - Restaurant name: bold, approx 25px
  - Distance: regular, approx 16px, format like “0.5 mi away”
- Safe-area aware top/bottom padding; max content width 393–480px.

### Interactions and Gestures
- **Swipe to vote**: Horizontal swipe on a restaurant card selects that card as the winner and the other as the loser.
  - Rightward swipe on a card = choose that card. The counterpart is implicitly the loser.
  - Completed swipe triggers a vote submission; the next matchup loads automatically.
- **Long press for details**: Press-and-hold on a card opens a bottom sheet with:
  - Photo, name, distance, address/link (`mapsUrl`), and brief description if available
  - ELO snapshots (global and the three categories) if useful to the user
  - Primary action: “Vote for this restaurant” (same outcome as a swipe)
- **Buttons**:
  - Undo (left, peach `#F7DCAD`): Reverses the last successful vote via `/api/undo`.
  - Skip (right, magenta `#741B3F`): Requests a new matchup without submitting a vote.

### Data Flow (App Router + SWR)
- Fetch matchup: `GET /api/matchup?category={value|aesthetics|speed}`
- Submit vote: `POST /api/vote` with `{ winnerId, loserId, category, matchupId }`
  - Response includes `voteId` and updated ratings; store `lastVoteId` for Undo.
- Undo vote: `POST /api/undo` with `{ voteId }`
- SWR:
  - Keyed by `['matchup', category]`
  - On successful vote or skip, revalidate to fetch the next pair
  - Optimistic UI for swipe animation; network failures roll back and show a toast

### States
- Loading: Skeleton rectangles for two cards; disabled interactions.
- Empty/Exhausted: Friendly message and a “Try Again” action if no active restaurants are returned.
- Error: Non-blocking toast with “Retry” and diagnostic logging (console only in dev).
- Undo:
  - Enabled only when there is a `lastVoteId` and the previous mutation succeeded.
  - Show brief confirmation toast when undo completes.

### Accessibility
- All interactive elements are reachable via keyboard:
  - Category pills: roving tab index + `aria-pressed`
  - Cards: Enter to open details; ArrowRight to “vote for this card”
  - Buttons have accessible names and focus states
- Motion reduction: Respect `prefers-reduced-motion` to shorten or skip swipe animations.
- Color contrast: Ensure text over images maintains 4.5:1 using the overlay.

### Responsive Behavior
- Mobile-first design (360–480px). On larger viewports:
  - Maintain a centered column with max-width 480px.
  - Increase card height modestly; do not exceed 16:9 aspect ratio.

### Visual Tokens (from design)
- Colors: 
  - Primary Magenta `#741B3F`
  - Peach-Yellow `#F7DCAD`
  - Dark Grey `#222222`
  - Accent Pink `#C87F9C`
  - White `#FFFFFF`
- Typography: Design uses Lexend for headings/body. Configure via `next/font` or map to existing font tokens consistent with the rest of the app.
- Radii: 20px cards, 15px primary buttons, 10px for small pills.
- Spacing: 16px baseline grid; 24–36px vertical rhythm between major sections.

### File Touchpoints
- `app/page.tsx` hosts the survey screen.
- `components/BottomNav.tsx` anchors the bottom navigation.
- Future components: `RestaurantCard`, `CategorySelector`, `RestaurantSheet`.

### Dev-Only User ID Fallback (Important)

During development, the vote API applies a default user identifier when the client does not provide one:

```typescript
// app/api/vote/route.ts (server)
const userId = body.userId ?? 'dev-user';
```

This is intended only to satisfy the database `votes.user_id NOT NULL` constraint for local testing, allowing votes to be stored without a full auth flow.

Warnings and requirements:
- Do NOT rely on `'dev-user'` in production. Replace with a real authenticated user id from your auth provider.
- The `VoteRequest` type includes `userId?: string` for completeness, but production clients should always provide a real user id.
- Remove or gate the dev fallback behind `process.env.NODE_ENV !== 'production'` before going live.

### Geolocation Utilities
- `lib/geo.ts` offers:
  - `parseLatLngFromMapsUrl(mapsUrl)` to extract coordinates from a Google Maps URL.
  - `useUserLocation()` React hook to request/store user coordinates in localStorage and sync across tabs.

### File Organization

```
types/
  restaurant.ts    - Core domain types (Restaurant, Matchup, VoteRecord)
  api.ts          - API request/response contracts

lib/
  elo.ts          - Pure ELO math (fixed K=32)
  image.ts        - Image path helpers
  supabase.ts     - Supabase client factory (getSupabaseAdmin)
  matchup.ts      - Random pairing generation
  rankings.ts     - Sort restaurants by category
  db/
    restaurants.ts - Restaurant repository (CRUD + updates)
    votes.ts       - Vote repository (store + undo)
  votes/
    submit.ts      - Vote submission logic (dual ELO updates)
    undo.ts        - Vote reversal logic (dual delta subtraction)

app/
  api/
    matchup/route.ts    - GET: Generate random restaurant pair
    vote/route.ts       - POST: Submit vote, update ratings
    undo/route.ts       - POST: Reverse last vote
    restaurants/route.ts - GET: Rankings by category
  layout.tsx            - Root layout with bottom nav
  page.tsx              - Home page
  favorites/page.tsx    - UIUC favorites (placeholder)
  game/page.tsx         - Survey/voting UI (placeholder)

components/
  BottomNav.tsx         - Fixed bottom navigation
  providers/
    SWRProvider.tsx     - SWR configuration wrapper
```

## Common Patterns

### Repository Functions
All repository functions follow this pattern:
```typescript
export async function someRepoFunction() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('table_name')
    .select('explicit, column, list')  // Never SELECT *
    .eq('filter', value);

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed: ${error.message}`);
  }

  return mapToTypeWithNumericCoercion(data);
}
```

### Vote Submission Flow
1. Fetch current restaurant states
2. Calculate global ELO update: `updatePairByOutcome(winner.eloGlobal, loser.eloGlobal, 'A')`
3. Calculate category ELO update: `updatePairByOutcome(winner.eloCategory, loser.eloCategory, 'A')`
4. Update both fields in database for both restaurants (4 fields total)
5. Store vote with 4 deltas
6. Return updated restaurants + voteId

### Category Key Mapping
```typescript
// Convert votable category to Restaurant property key
const categoryKey = `elo${category.charAt(0).toUpperCase()}${category.slice(1)}` as
  'eloValue' | 'eloAesthetics' | 'eloSpeed';

// 'value' → 'eloValue'
// 'aesthetics' → 'eloAesthetics'
// 'speed' → 'eloSpeed'
```

## Important Implementation Details

**Column Name Mapping (DB ↔ Domain):**
- `elo_global` ↔ `eloGlobal`
- `elo_value` ↔ `eloValue`
- `image_url` ↔ `imageSlug` (domain keeps `imageSlug` for backwards compatibility)
- `distance_miles` ↔ `distanceMiles`
- `maps_url` ↔ `mapsUrl`

**Deprecated Types (backwards compatibility):**
- `RatingCategory` - use `VotableCategory` or `SortableCategory`
- `CategoryRatingState` - no longer used (was nested structure)
- `RATING_CATEGORIES` - use `VOTABLE_CATEGORIES` or `SORTABLE_CATEGORIES`

**API Response Format:**
All API routes return:
```typescript
{ ok: true, data: {...} }  // Success
{ ok: false, error: "..." } // Failure
```

**Image Path Behavior:**
- `lib/image.ts` computes display paths without I/O:
  - If `imageSlug` is an absolute URL, use as-is.
  - If `imageSlug` is a relative path, normalize with leading `/`.
  - Otherwise fallback to `/restaurants/{slug}.webp` (preferred), with `.jpg`/`.png` as alternates via `getRestaurantImageCandidates`.

## Migration Context

This codebase recently migrated from in-memory storage to Supabase with architectural simplification. See `SUPABASE_MIGRATION.md` for complete migration history and technical decisions. The migration:
- Flattened nested `ratings` object to top-level ELO fields
- Removed game count tracking (fixed K-factor)
- Separated votable from sortable categories
- Implemented dual ELO updates (global + category)
- Added stateless undo with delta storage

### Migration: image_slug → image_url

Standardize the image column to `image_url` (stores a public URL).

1) Run this SQL in the Supabase SQL Editor:

```sql
ALTER TABLE public.restaurants
  RENAME COLUMN image_slug TO image_url;

-- Optional: enforce type/comment
-- ALTER TABLE public.restaurants ALTER COLUMN image_url TYPE text;
-- COMMENT ON COLUMN public.restaurants.image_url IS 'Public image URL used by the app';
```

2) Code compatibility
- Repository maps DB → domain as: `image_url` ↔ `imageSlug` (domain keeps name for now).
- Backfill and utility scripts now read/write `image_url`.

## Testing & Validation

**Type Safety:**
```bash
npx tsc --noEmit  # Must pass with no errors
```

**API Testing Checklist:**
- Vote on 'value' updates BOTH `elo_global` and `elo_value`
- Vote record stores all 4 deltas
- Undo reverses BOTH ratings exactly
- Trying to vote with `category='overall'` fails validation
- Rankings with `category='global'` sorts by `elo_global`
 - `/api/matchup` with insufficient active restaurants returns 404 (NoMatchupError)

**Common Pitfalls:**
1. Forgetting to coerce NUMERIC columns with `Number()`
2. Using nested access like `restaurant.ratings.value.rating` (old structure)
3. Allowing 'overall' as a votable category (it's not!)
4. Updating only one ELO rating instead of both (global + category)
5. Using `SELECT *` instead of explicit column lists
6. Missing Supabase server credentials (repositories will throw "Supabase not configured")
