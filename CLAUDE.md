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

### Mobile-First UI

- Max width: 480px centered container
- iOS safe-area padding for notch/home indicator
- Fixed bottom navigation with 2 items (Survey, UIUC Favorites)
- Tailwind v4 with `@theme` inline configuration
- Geist Sans font family

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
- `image_slug` ↔ `imageSlug`
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

## Migration Context

This codebase recently migrated from in-memory storage to Supabase with architectural simplification. See `SUPABASE_MIGRATION.md` for complete migration history and technical decisions. The migration:
- Flattened nested `ratings` object to top-level ELO fields
- Removed game count tracking (fixed K-factor)
- Separated votable from sortable categories
- Implemented dual ELO updates (global + category)
- Added stateless undo with delta storage

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

**Common Pitfalls:**
1. Forgetting to coerce NUMERIC columns with `Number()`
2. Using nested access like `restaurant.ratings.value.rating` (old structure)
3. Allowing 'overall' as a votable category (it's not!)
4. Updating only one ELO rating instead of both (global + category)
5. Using `SELECT *` instead of explicit column lists
