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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
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
  if (!v) {
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
}

function parseLatLngFromMapsUrl(mapsUrl) {
  if (!mapsUrl) return null;
  const atMatch = mapsUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  }
  const qMatch = mapsUrl.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (qMatch) {
    return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
  }
  return null;
}

async function resolveFinalUrl(url) {
  try {
    const resp = await fetch(url, { redirect: 'follow' });
    // resp.url is the final URL after redirects
    return resp.url || url;
  } catch {
    return url;
  }
}

async function backfill() {
  console.log('Backfilling lat/lng from maps_url shortlinks...');
  await loadEnvFromDotenvLocal();

  const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const SUPABASE_SERVICE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
    auth: { persistSession: false },
  });

  // Fetch candidates with missing lat/lng but having a maps_url
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, maps_url, lat, lng')
    .is('lat', null)
    .is('lng', null)
    .not('maps_url', 'is', null);

  if (error) {
    throw new Error(`Failed to query restaurants: ${error.message}`);
  }

  const rows = data || [];
  console.log(`Found ${rows.length} restaurants to process`);

  let updated = 0;
  for (const row of rows) {
    const original = row.maps_url;
    const finalUrl = await resolveFinalUrl(original);
    const ll = parseLatLngFromMapsUrl(finalUrl);
    if (!ll) {
      console.log(`No coords for: ${row.name} (${row.id}) -> ${finalUrl}`);
      continue;
    }

    const { error: updErr } = await supabase
      .from('restaurants')
      .update({ lat: ll.lat, lng: ll.lng })
      .eq('id', row.id);

    if (updErr) {
      console.error(`Update failed for ${row.id}: ${updErr.message}`);
      continue;
    }
    updated++;
    console.log(`Updated ${row.name} (${row.id}) -> lat=${ll.lat}, lng=${ll.lng}`);
    // Gentle pacing
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`Done. Updated ${updated}/${rows.length} restaurants.`);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});


