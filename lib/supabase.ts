import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server admin client (read/write, used in API routes and lib/*)
export function getSupabaseAdmin() {
  // Return null (handled upstream) if any required server creds are missing
  if (!service || !url) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

// Optional: public server client (read-only)
export function getSupabasePublic() {
  if (!url || !anon) {
    throw new Error("Supabase public client not configured: missing URL or anon key");
  }
  return createClient(url, anon, { auth: { persistSession: false } });
}
