import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server admin client (read/write, used in API routes and lib/*)
export function getSupabaseAdmin() {
  if (!service) return null; // fall back to in-memory repo
  return createClient(url, service, { auth: { persistSession: false } });
}

// Optional: public server client (read-only)
export function getSupabasePublic() {
  return createClient(url, anon, { auth: { persistSession: false } });
}
