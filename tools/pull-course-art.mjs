/* ═══════════════════════════════════════════════════════════
   Download GLOW's own course cover art.

   Reads .gen/crawl/public.json (produced by crawl-public.mjs) and pulls
   every `pluginfile.php/.../course/overviewfiles/...` image into
   public/assets/img/courses/<slug>.<ext>.

   Why this exists: the rebuild was reusing three hero slides as stand-in
   covers for seventeen different tracks, so ETOP, TOEIC and Pronunciation
   all wore the same picture. These are the real covers, from GLOW.

   pluginfile.php needs the anonymous MoodleSession cookie like everything
   else here, so the same jar applies.
   ═══════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { extname } from 'node:path';

const ORIGIN = 'https://glow.mata9.com';
const DIR = 'public/assets/img/courses';
const MAP = '.gen/crawl/course-art.json';

const jar = new Map();
function remember(res) {
  for (const [k, v] of res.headers) {
    if (k.toLowerCase() !== 'set-cookie') continue;
    for (const part of v.split(/,(?=[^;]+=)/)) {
      const [n, val] = part.split(';')[0].split('=');
      if (n && val) jar.set(n.trim(), val.trim());
    }
  }
}
const headers = () => ({
  cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36',
  referer: ORIGIN + '/',
});

const slug = s => s.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   /* Vietnamese diacritics */
  .replace(/đ/g, 'd')
  .replace(/\bcopy\b/g, '')                            /* their duplicated courses */
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const crawl = JSON.parse(readFileSync('.gen/crawl/public.json', 'utf8'));

/* The six Upskilling courses already ship their covers under the names
   index.html references. Re-downloading them under slugged names would put
   the same six images in the build twice — about 1.7MB of duplicate bytes
   for no gain. */
const ALREADY_SHIPPED = {
  2489: 'course-teamwork.png',
  2487: 'course-communication.png',
  2486: 'course-leadership.png',
  2488: 'course-antitrafficking.png',
  2441: 'course-ai.png',
  2440: 'course-finance.png',
};

/* One entry per course that published a cover. Enrol-page hits and
   catalogue hits can both supply one; either is the same file. */
const wanted = new Map();
for (const c of crawl.courses) {
  if (c.image) wanted.set(c.id, { id: c.id, name: c.title || c.navName, url: c.image });
}
for (const c of crawl.catalogue) {
  if (c.image && !wanted.has(c.id)) wanted.set(c.id, { id: c.id, name: c.name, url: c.image });
}

mkdirSync(DIR, { recursive: true });

/* Warm-up for the session cookie. */
{
  const r = await fetch(ORIGIN + '/', { redirect: 'manual' });
  remember(r);
  await r.arrayBuffer();
}

const map = {};
let ok = 0, skipped = 0, failed = 0;

for (const { id, name, url } of wanted.values()) {
  if (ALREADY_SHIPPED[id]) {
    skipped++;
    map[id] = { name, file: `../${ALREADY_SHIPPED[id]}`, note: 'already in public/assets/img' };
    continue;
  }
  const base = slug(name) || `course-${id}`;
  const ext = (extname(new URL(url).pathname).toLowerCase() || '.png').split('?')[0];
  const file = `${base}${ext}`;
  const path = `${DIR}/${file}`;

  if (existsSync(path)) { skipped++; map[id] = { name, file }; continue; }

  try {
    const r = await fetch(url, { headers: headers(), redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    /* Moodle serves the login page as 200 HTML when the session lapses —
       a 3KB "image" that is actually markup would silently ship. */
    if (buf.length < 2000 || buf.slice(0, 200).toString('utf8').includes('<html')) {
      throw new Error(`not an image (${buf.length}B)`);
    }
    writeFileSync(path, buf);
    map[id] = { name, file, bytes: buf.length };
    ok++;
    console.log(`  ok    ${String(id).padStart(5)}  ${file}  ${(buf.length / 1024).toFixed(0)}KB`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${String(id).padStart(5)}  ${name} — ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 200));
}

writeFileSync(MAP, JSON.stringify(map, null, 2));
console.log(`\ndownloaded ${ok}, already present ${skipped}, failed ${failed}`);
console.log(`map -> ${MAP}`);
