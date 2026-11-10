/* ═══════════════════════════════════════════════════════════
   Pull the PUBLIC course summary for every catalogue course that has a
   numeric moodleId. /course/info.php answers anonymously, so no login.

   Output: .gen/crawl/course-summaries.json  (array, catalogue order)
   ═══════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COURSES } from '../server/data/catalogue.js';

const ORIGIN = 'https://glow.mata9.com';
const OUT = fileURLToPath(new URL('../.gen/crawl/course-summaries.json', import.meta.url));

/* Same cookie-jar approach as crawl-public.mjs: Node's fetch keeps no
   cookies, and Moodle wants the session cookie back before it renders. */
const jar = new Map();

function remember(res) {
  for (const [k, v] of res.headers) {
    if (k.toLowerCase() !== 'set-cookie') continue;
    for (const part of v.split(/,(?=[^;]+=)/)) {
      const [name, val] = part.split(';')[0].split('=');
      if (name && val) jar.set(name.trim(), val.trim());
    }
  }
}

const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function get(path) {
  const r = await fetch(ORIGIN + path, {
    redirect: 'follow',
    headers: {
      cookie: cookieHeader(),
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      'accept-language': 'en,vi;q=0.9',
    },
  });
  remember(r);
  return { status: r.status, url: r.url, html: await r.text() };
}

/* Named entities used on Moodle pages, plus any numeric &#NNN; / &#xHH;. */
const NAMED = { amp: '&', nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  }
  return NAMED[e.toLowerCase()] ?? m;
});

/* Strip tags first, then decode, so &lt;b&gt; in text is not mistaken for markup. */
const clean = html => decode(
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
).replace(/\s+/g, ' ').trim();

/* Inner HTML of the first <div> whose class list contains `cls`.
   Its closing tag is found by counting nested <div>s. */
function divInner(html, cls) {
  const open = new RegExp(`<div\\b[^>]*class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"[^>]*>`, 'i').exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const tag = /<(\/?)div\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 1;
  let m;
  while ((m = tag.exec(html))) {
    if (m[1]) {
      if (--depth === 0) return html.slice(start, m.index);
    } else if (!/\/>$/.test(m[0])) {
      depth++;
    }
  }
  return null; // unclosed div: treat as missing rather than take the rest of the page
}

/* Lead = every non-empty <p> plus any loose text in the block, in order.
   Lists are removed first so their items do not leak into the lead. */
function leadOf(block) {
  const noLists = block.replace(/<(ul|ol)\b[\s\S]*?<\/\1>/gi, '\n');
  return noLists
    .split(/(<p\b[^>]*>[\s\S]*?<\/p>)/i)
    .map(part => {
      const p = /^<p\b[^>]*>([\s\S]*?)<\/p>$/i.exec(part);
      return clean(p ? p[1] : part);
    })
    .filter(Boolean)
    .join('\n');
}

function parseSummary(html) {
  /* Only ever read inside the course's .summary box: a login or error page
     served as 200 must come back empty, not as theme text saved as a lead. */
  const summary = divInner(html, 'summary');
  const block = summary === null ? null : divInner(summary, 'no-overflow');
  const titleRe = /<h3[^>]*class="coursename"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i;
  const titleHit = (summary ?? '').match(titleRe);
  const moodleTitle = titleHit ? clean(titleHit[1]) || null : null;

  if (block === null) return { moodleTitle, lead: '', bullets: [], blockFound: false };

  const bullets = [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(m => clean(m[1]))
    .filter(Boolean);
  return { moodleTitle, lead: leadOf(block), bullets, blockFound: true };
}

/* ── run ─────────────────────────────────────────────────────── */
mkdirSync(fileURLToPath(new URL('../.gen/crawl/', import.meta.url)), { recursive: true });

/* Warm-up with redirect:'manual' so the Set-Cookie on the first hop is kept. */
{
  const r = await fetch(ORIGIN + '/', { redirect: 'manual' });
  remember(r);
  await r.arrayBuffer();
  console.log(`session cookie: ${jar.size ? [...jar.keys()].join(', ') : 'NONE'}`);
}

const targets = COURSES.filter(c => Number.isInteger(c.moodleId));
console.log(`courses with a numeric moodleId: ${targets.length}`);

const results = [];
for (const c of targets) {
  let entry;
  try {
    const { status, html } = await get(`/course/info.php?id=${c.moodleId}`);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    const r = parseSummary(html);
    entry = { code: c.code, moodleId: c.moodleId, moodleTitle: r.moodleTitle, lead: r.lead, bullets: r.bullets };
    console.log(`  ${c.code.padEnd(8)} ${String(c.moodleId).padStart(5)}  ${r.blockFound ? 'block' : 'NO-BLOCK'}  lead=${r.lead ? 'y' : 'n'}  bullets=${r.bullets.length}  ${r.moodleTitle ?? ''}`);
  } catch (e) {
    entry = { code: c.code, moodleId: c.moodleId, moodleTitle: null, lead: '', bullets: [], error: e.message };
    console.log(`  ${c.code.padEnd(8)} ${String(c.moodleId).padStart(5)}  [ERROR] ${e.message}`);
  }
  results.push(entry);
  await new Promise(r => setTimeout(r, 250));
}

writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');

const withContent = results.filter(r => r.lead || r.bullets.length);
const empty = results.filter(r => !r.lead && !r.bullets.length).map(r => r.code);
console.log(`\nfetched: ${results.length}`);
console.log(`with lead or bullets: ${withContent.length}`);
console.log(`empty: ${empty.length ? empty.join(', ') : 'none'}`);
console.log(`wrote ${OUT}`);
