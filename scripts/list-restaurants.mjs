// How to run:
// - From C:\Users\yeyuc\Documents\courses\fork_fight:   npm run list:restaurants
// - From C:\Users\yeyuc\Documents\courses:              npm --prefix fork_fight run list:restaurants
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function loadEnvFromDotenvLocal() {
  const dotenvPath = path.resolve(projectRoot, '.env.local');
  try {
    const content = await fs.readFile(dotenvPath, 'utf8');
    const lines = content.split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore if missing
  }
}

function requireEnv(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

async function main() {
  await loadEnvFromDotenvLocal();

  const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const SUPABASE_SERVICE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Failed to fetch restaurants: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('No active restaurants found.');
    return;
  }

  // Pretty print a compact table of fields
  const rows = data.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    elo_global: r.elo_global,
    image_url: r.image_url ?? r.image_slug,
    maps_url: r.maps_url,
  }));

  console.table(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


