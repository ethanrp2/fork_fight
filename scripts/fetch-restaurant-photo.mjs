import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

async function findPhotoReference({ name, mapsUrl, apiKey }) {
  const coords = parseLatLngFromMapsUrl(mapsUrl);
  const bias = coords ? `&locationbias=point:${coords.lat},${coords.lng}` : '';
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
    name
  )}&inputtype=textquery&fields=place_id,photos${bias}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Find Place failed: ${resp.status} ${resp.statusText}`);
  }
  const json = await resp.json();
  const photoRef = json?.candidates?.[0]?.photos?.[0]?.photo_reference;
  return photoRef || null;
}

function extensionFromContentType(ct) {
  if (!ct) return 'jpg';
  if (ct.includes('image/webp')) return 'webp';
  if (ct.includes('image/png')) return 'png';
  if (ct.includes('image/jpeg')) return 'jpg';
  return 'jpg';
}

async function downloadPhotoBytes({ photoRef, apiKey, maxWidth = 1024 }) {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(
    photoRef
  )}&key=${apiKey}`;
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`Photo download failed: ${resp.status} ${resp.statusText}`);
  }
  const arrayBuf = await resp.arrayBuffer();
  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  return { bytes: new Uint8Array(arrayBuf), contentType };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  console.log('Starting single-restaurant photo fetch test...');
  await loadEnvFromDotenvLocal();

  const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const SUPABASE_SERVICE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const GOOGLE_KEY = requireEnv('GOOGLE_MAPS_API_KEY');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, maps_url')
    .eq('active', true)
    .not('maps_url', 'is', null)
    .limit(1)
    .single();

  if (error) {
    throw new Error(`Failed to fetch restaurant: ${error.message}`);
  }
  if (!restaurant) {
    console.log('No restaurant found with a maps_url.');
    return;
  }

  console.log(`Selected restaurant: ${restaurant.name} (${restaurant.slug})`);
  const photoRef = await findPhotoReference({ name: restaurant.name, mapsUrl: restaurant.maps_url, apiKey: GOOGLE_KEY });
  if (!photoRef) {
    console.log('No photo_reference found for this place.');
    return;
  }
  console.log('Got photo_reference, downloading image...');

  const { bytes, contentType } = await downloadPhotoBytes({ photoRef, apiKey: GOOGLE_KEY });
  const ext = extensionFromContentType(contentType);
  const outDir = path.resolve(projectRoot, 'public', 'restaurants');
  await ensureDir(outDir);
  const outPath = path.join(outDir, `${restaurant.slug}.${ext}`);
  await fs.writeFile(outPath, bytes);

  console.log(`Saved image to: ${path.relative(projectRoot, outPath)} (${contentType}, ${bytes.length} bytes)`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


