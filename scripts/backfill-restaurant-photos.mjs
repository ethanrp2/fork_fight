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
  if (!resp.ok) throw new Error(`Find Place failed: ${resp.status} ${resp.statusText}`);
  const json = await resp.json();
  return json?.candidates?.[0]?.photos?.[0]?.photo_reference || null;
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
  if (!resp.ok) throw new Error(`Photo download failed: ${resp.status} ${resp.statusText}`);
  const arrayBuf = await resp.arrayBuffer();
  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  return { bytes: new Uint8Array(arrayBuf), contentType };
}

async function ensureBucket(supabase, bucket) {
  try {
    await supabase.storage.createBucket(bucket, { public: true });
    return;
  } catch {
    // bucket may already exist; try to ensure it's public
    try {
      await supabase.storage.updateBucket(bucket, { public: true });
    } catch {
      // ignore if cannot update; may already be public
    }
  }
}

async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('Starting backfill of restaurant photos to Supabase Storage...');
  await loadEnvFromDotenvLocal();

  const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const SUPABASE_SERVICE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const GOOGLE_KEY = requireEnv('GOOGLE_MAPS_API_KEY');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });

  const BUCKET = 'restaurants';
  await ensureBucket(supabase, BUCKET);

  // Fetch active restaurants with maps_url present (overwrite any existing image values)
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, maps_url, image_url')
    .eq('active', true)
    .not('maps_url', 'is', null)
    .order('name');

  if (error) throw new Error(`Failed to fetch restaurants: ${error.message}`);
  if (!restaurants || restaurants.length === 0) {
    console.log('Nothing to backfill. No active restaurants with maps_url found.');
    return;
  }

  console.log(`Found ${restaurants.length} restaurants to process.`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of restaurants) {
    const id = r.id;
    const name = r.name;
    const slug = r.slug;
    const mapsUrl = r.maps_url;

    try {
      console.log(`\nProcessing: ${name} (${slug})`);
      const photoRef = await findPhotoReference({ name, mapsUrl, apiKey: GOOGLE_KEY });
      if (!photoRef) {
        console.log('  No photo_reference found. Skipping.');
        skipped++;
        continue;
      }
      console.log('  Found photo_reference. Downloading...');
      const { bytes, contentType } = await downloadPhotoBytes({ photoRef, apiKey: GOOGLE_KEY });
      const ext = extensionFromContentType(contentType);
      const storagePath = `${BUCKET}/${slug}.${ext}`.replace(`${BUCKET}/`, ''); // path within bucket

      // Upload to storage (upsert to avoid failure on reruns)
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
        contentType,
        upsert: true,
      });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;
      console.log(`  Uploaded to storage: ${publicUrl}`);

      const { error: updErr } = await supabase
        .from('restaurants')
        .update({ image_url: publicUrl })
        .eq('id', id);
      if (updErr) throw updErr;
      console.log('  Updated image_url in database.');
      success++;
    } catch (e) {
      console.error('  Failed:', e?.message || e);
      failed++;
    }

    // Gentle rate limit to be safe
    await delay(300);
  }

  console.log('\nBackfill complete.');
  console.log(`  Success: ${success}`);
  console.log(`  Skipped (no photo): ${skipped}`);
  console.log(`  Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


