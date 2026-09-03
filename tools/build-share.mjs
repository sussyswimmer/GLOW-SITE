/* Build a share-only bundle: the public landing page and nothing else.
   node tools/build-share.mjs            -> dist-share/

   The site is two halves — these pages and a Fastify server that answers
   /api. A static host serves the first and not the second, so the platform
   pages would load their shell and then 404 on every request behind it.
   Rather than ship a front door with broken rooms behind it, this takes
   index.html alone and re-points the links that would have led into them.

   The rewrite is listed in LINKS below, so what a viewer can and cannot click
   is one table rather than something to discover by clicking. */

import { readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const SRC = 'dist';
const OUT = 'dist-share';

/* Where each platform link goes instead. Every target is a section of the
   landing page that actually answers the same question. */
const LINKS = [
  ['./english.html',   '#tracks'],    // English self-learning -> the English tracks
  ['./courses.html',   '#courses'],   // Courses               -> the course row
  ['./resources.html', '#pillars'],   // Resources             -> the three pillars
  ['./dashboard.html', '#courses'],   // Start learning        -> the course row
];

const html0 = await readFile(join(SRC, 'index.html'), 'utf8');
let html = html0;

/* Sign-in cannot be re-pointed anywhere honest — there is no sign-in here —
   so both entry points come out entirely rather than lead somewhere that
   isn't a sign-in page. Done BEFORE the href rewrite, or they'd be caught by
   the ./dashboard.html rule above. */
const removed = [];
html = html.replace(
  /\s*<a class="btn-login" href="\.\/dashboard\.html"[^>]*>.*?<\/a>/s,
  m => { removed.push('header sign-in button'); return ''; });
html = html.replace(
  /\s*<a href="\.\/dashboard\.html"[^>]*>[^<]*<\/a>(?=\s*<\/div>)/s,
  m => { removed.push('footer sign-in link'); return ''; });

const rewrites = [];
for (const [from, to] of LINKS) {
  const n = html.split(`href="${from}"`).length - 1;
  if (n) { html = html.replaceAll(`href="${from}"`, `href="${to}"`); rewrites.push(`${from} -> ${to} (${n})`); }
}

const left = [...html.matchAll(/href="\.\/([a-z-]+\.html)"/g)].map(m => m[1]);
if (left.length) throw new Error(`unhandled platform link(s): ${[...new Set(left)].join(', ')}`);

/* Only the assets this one page actually reaches for. dist/ carries the whole
   site — the course catalogue art alone is megabytes the landing page never
   shows. Both the markup and the page's own JS bundle are scanned, so an
   asset named only in script is not silently left behind. */
const wanted = new Set();
const scan = text => {
  for (const m of text.matchAll(/\.?\/?(assets\/[A-Za-z0-9._/-]+?\.(?:css|js|png|jpe?g|webp|gif|svg|woff2?))/g)) {
    wanted.add(m[1]);
  }
};
scan(html);
for (const a of [...wanted]) {
  if (a.endsWith('.js') || a.endsWith('.css')) scan(await readFile(join(SRC, a), 'utf8'));
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'index.html'), html);

let bytes = Buffer.byteLength(html);
for (const a of wanted) {
  const from = join(SRC, a);
  try { bytes += (await stat(from)).size; } catch { console.warn(`  ! missing ${a}`); continue; }
  await mkdir(dirname(join(OUT, a)), { recursive: true });
  await cp(from, join(OUT, a));
}

console.log(`${OUT}/  —  ${wanted.size + 1} files, ${(bytes / 1e6).toFixed(2)} MB`);
console.log('  removed :', removed.length ? removed.join(', ') : 'nothing');
console.log('  rewrote :');
for (const r of rewrites) console.log('     ', r);
