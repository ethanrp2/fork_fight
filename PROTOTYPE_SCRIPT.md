- **Build**: Built with Next.js 16 (App Router) and React 19 in strict TypeScript, styled with Tailwind CSS v4. Data lives in Supabase Postgres via `@supabase/supabase-js`, with client fetching through SWR. Thin route handlers in `app/api/*` orchestrate repositories in `lib/db/*` and pure modules in `lib/*`.\n
\n
- **Novelty**: A layered-by-purity approach keeps ELO math and types pure, composed by repositories, then exposed via minimal APIs. A fixed K‑factor ELO enables predictable updates, optimistic UI, and a simple Undo flow. SWR `fallbackData` and targeted cache mutations keep the interface fast and spinner‑free.\n
\n
- **Architecture**: Flow: UI → SWR → `/api` handlers → `lib/db/*` → Supabase. `sessionStorage` holds survey state that influences SWR keys without coupling UI to data access. Optional geolocation refines rankings while preserving separation of concerns.\n

