import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const restaurantName = 'Taco Bell';

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

function extensionFromContentType(ct) {
  if (!ct) return 'jpg';
  const lower = ct.toLowerCase();
  if (lower.includes('image/webp')) return 'webp';
  if (lower.includes('image/png')) return 'png';
  if (lower.includes('image/jpeg') || lower.includes('image/jpg')) return 'jpg';
  return 'jpg';
}

function extensionFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const ext = path.extname(u.pathname).toLowerCase().replace(/^\./, '');
    if (ext) return ext;
  } catch {
    // ignore parse error
  }
  return null;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  console.log(`Checking ${restaurantName} row and downloading image if present...`);
  await loadEnvFromDotenvLocal();

  const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const SUPABASE_SERVICE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });

  const { data: r, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, maps_url, image_url')
    .eq('name', restaurantName)
    .single();

  if (error) {
    throw new Error(`Failed to fetch ${restaurantName}: ${error.message}`);
  }

  if (!r) {
    console.log(`Restaurant ${restaurantName} not found.`);
    return;
  }

  const mapsUrl = r.maps_url;
  const imageUrl = r.image_url;

  console.log(`Found: ${r.name} (slug=${r.slug})`);
  console.log(`  maps_url: ${mapsUrl || '(none)'}`);
  console.log(`  image_url: ${imageUrl || '(none)'}`);

  if (!mapsUrl || !imageUrl) {
    console.log('Missing maps_url or image_url; nothing to download.');
    return;
  }

  console.log('Both maps_url and image_url present. Downloading image...');
  const resp = await fetch(imageUrl, { redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`Image download failed: ${resp.status} ${resp.statusText}`);
  }
  const arrayBuf = await resp.arrayBuffer();
  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  let ext = extensionFromContentType(contentType);
  const urlExt = extensionFromUrl(imageUrl);
  if (urlExt && (ext === 'jpg' || ext === 'jpeg')) {
    // Prefer explicit url extension when content-type is generic jpeg
    ext = urlExt;
  }

  const outDir = path.resolve(projectRoot, 'public', 'restaurants');
  await ensureDir(outDir);
  const outPath = path.join(outDir, `${r.slug}.${ext}`);
  await fs.writeFile(outPath, new Uint8Array(arrayBuf));

  console.log(`Saved image to: ${path.relative(projectRoot, outPath)} (${contentType}, ${arrayBuf.byteLength} bytes)`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


