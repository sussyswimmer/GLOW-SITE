/* ═══════════════════════════════════════════════════════════
   Harvest everything glow.mata9.com exposes WITHOUT a login.

   Guest hits on /course/view.php?id=N bounce to /enrol/index.php?id=N,
   which still renders the real full name, category path and course
   summary. That is enough to make the rebuild's catalogue factual —
   real ids, real titles, real categories, real summaries — and to make
   every course link deep-link into the actual platform.

   What this CANNOT reach, by design, is course interiors (sections,
   activities, media). Those need an authenticated session; see
   CONTENT.md "Still behind the login".

   Output: .gen/crawl/public.json
   ═══════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs';

const ORIGIN = 'https://glow.mata9.com';
const OUT = '.gen/crawl/public.json';

const strip = s => (s || '').replace(/\s+/g, ' ').trim();

/* Moodle hands an anonymous visitor a MoodleSession cookie and only
   renders the enrolment page (title, category, summary) once it sees it
   come back. Node's fetch has no cookie jar, so keep one by hand —
   without this every request lands on the login form instead. */
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
      /* Moodle's theme varies output by UA; ask for the desktop page. */
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      'accept-language': 'en,vi;q=0.9',
    },
  });
  remember(r);
  return { status: r.status, url: r.url, html: await r.text() };
}

/* Moodle renders no wrapper we can rely on across themes, so pull the
   fields by their stable markup instead of by position. */
function field(html, re) {
  const m = html.match(re);
  return m ? strip(m[1].replace(/<[^>]+>/g, ' ')) : null;
}

/* ── 1. every course the public navigation knows about ───────── */
async function navCourses() {
  const { html } = await get('/');
  const seen = new Map();
  /* Do not anchor on the closing quote: their own menu appends `#section-4`
     to IELTS, and Placement Assessment's href is `id=245%5C` — a stray
     backslash that makes that menu item broken on the live site. Both are
     recorded rather than silently dropped. */
  for (const m of html.matchAll(/href="[^"]*course\/view\.php\?id=(\d+)([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const id = Number(m[1]);
    const suffix = m[2];
    const name = strip(m[3].replace(/<[^>]+>/g, ' '));
    if (!seen.has(id) && name) {
      seen.set(id, {
        id, navName: name,
        ...(suffix ? { navHrefSuffix: suffix } : {}),
        ...(/%5C|\\/.test(suffix) ? { navHrefBroken: true } : {}),
      });
    }
  }
  return [...seen.values()];
}

/* ── 2. what the enrolment page will tell an anonymous visitor ── */
async function courseFacts(id) {
  const { html, url } = await get(`/course/view.php?id=${id}`);

  const unavailable = /currently unavailable to students/i.test(html);
  const needsLogin = /\/login\/index\.php/.test(url) || /<title>[^<]*Log in to the site/i.test(html);
  const title = field(html, /<title>([\s\S]*?)<\/title>/i)?.replace(/\s*\|\s*GLOW\s*$/, '');
  const heading = field(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);

  /* Category shows up as a labelled row on the enrol page. */
  const category = field(html, /Course category[\s\S]{0,120}?>\s*([^<]{2,80})\s*</i);

  /* The summary block: theme lambda2 wraps it in .box.generalbox or
     .course_summary. Take the longest prose block, not the first —
     the enrol page also carries short boilerplate in the same wrappers. */
  const candidates = [];
  for (const re of [
    /<div class="[^"]*course_summary[^"]*">([\s\S]*?)<\/div>\s*<\/div>/gi,
    /<div class="[^"]*no-overflow[^"]*">([\s\S]*?)<\/div>/gi,
    /<div class="[^"]*box generalbox[^"]*">([\s\S]*?)<\/div>\s*<\/div>/gi,
  ]) {
    for (const m of html.matchAll(re)) {
      const v = strip(m[1].replace(/<[^>]+>/g, ' '));
      if (v.length > 30) candidates.push(v);
    }
  }
  const summary = candidates.sort((a, b) => b.length - a.length)[0]?.slice(0, 900) || null;

  /* Activity names, on the rare course a guest may see into. */
  const acts = [...html.matchAll(/class="[^"]*instancename[^"]*">([\s\S]*?)<span/gi)]
    .map(m => strip(m[1].replace(/<[^>]+>/g, ' '))).filter(Boolean).slice(0, 100);

  /* Course cover image, if the theme published one. */
  const image = html.match(/src="([^"]*pluginfile\.php\/[^"]*course\/overviewfiles\/[^"]*)"/i)?.[1]
    || html.match(/src="([^"]*courseimage[^"]*)"/i)?.[1] || null;

  return {
    id, title, heading, category, summary, image, acts,
    unavailableToGuests: unavailable,
    needsLogin,
    landedOn: url.replace(ORIGIN, ''),
    url: `${ORIGIN}/course/view.php?id=${id}`,
  };
}

/* ── 3. the publicly listed catalogue ────────────────────────
   /course/index.php renders a `.coursebox` per course that anyone may
   browse. It carries the cover image and the syllabus bullets, which
   the enrol page does not — so it is a second, richer source for the
   handful of courses that appear on it. */
async function publicCatalogue() {
  const { html } = await get('/course/index.php');
  const out = [];
  for (const m of html.matchAll(/data-courseid="(\d+)"[\s\S]*?(?=data-courseid="|<\/div><\/div><\/div>\s*<\/div>\s*<\/div>|$)/g)) {
    const block = m[0];
    const id = Number(m[1]);
    const name = field(block, /<h3 class="coursename"><a[^>]*>([\s\S]*?)<\/a>/i);
    const category = field(block, /class="categoryname[^"]*">([\s\S]*?)</i);
    const image = block.match(/class="courseimage"\s+data-src="([^"]+)"/i)?.[1] || null;
    /* Syllabus lines are <li> inside the summary block. */
    const bullets = [...block.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
      .map(b => strip(b[1].replace(/<[^>]+>/g, ' '))).filter(Boolean);
    /* The lead-in line above the bullets ("NỘI DUNG KHÓA HỌC:", "MỤC TIÊU:"). */
    const lead = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(b => strip(b[1].replace(/<[^>]+>/g, ' '))).find(t => t.length > 3) || null;
    if (name) out.push({ id, name, category, image, lead, bullets });
  }
  /* Each course appears twice (heading + summary block); keep the richer. */
  const best = new Map();
  for (const c of out) {
    const prev = best.get(c.id);
    if (!prev || (c.bullets.length > prev.bullets.length)) best.set(c.id, c);
  }
  return [...best.values()];
}

/* ── run ─────────────────────────────────────────────────────── */
mkdirSync('.gen/crawl', { recursive: true });

/* Warm-up with redirect:'manual' so the Set-Cookie on the first hop is
   captured before any redirect swallows it. */
{
  const r = await fetch(ORIGIN + '/', { redirect: 'manual' });
  remember(r);
  await r.arrayBuffer();
  console.log(`session cookie: ${jar.size ? [...jar.keys()].join(', ') : 'NONE — expect login redirects'}`);
}

const nav = await navCourses();
console.log(`nav: ${nav.length} courses`);

const courses = [];
/* Serial with a small gap — this is someone else's production Moodle,
   and 37 pages is not worth hammering it for. */
for (const c of nav) {
  try {
    const f = await courseFacts(c.id);
    courses.push({ ...c, ...f });
    console.log(`  ${String(c.id).padStart(5)}  ${f.unavailableToGuests ? '[gated]' : '       '} ${f.title ?? c.navName}`);
  } catch (e) {
    courses.push({ ...c, error: String(e) });
    console.log(`  ${String(c.id).padStart(5)}  [ERROR] ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 250));
}

const catalogue = await publicCatalogue();
console.log(`\ncatalogue: ${catalogue.length} publicly listed courses`);
for (const c of catalogue) console.log(`  ${String(c.id).padStart(5)}  ${c.name}  (${c.bullets.length} syllabus lines)`);

const byCategory = {};
for (const c of courses) (byCategory[c.category || 'unknown'] ??= []).push(c.title || c.navName);

writeFileSync(OUT, JSON.stringify({ crawledFrom: ORIGIN, courses, catalogue, byCategory }, null, 2));
console.log(`\nwrote ${OUT}`);
console.log(`categories: ${Object.keys(byCategory).join(' | ')}`);
console.log(`gated from guests: ${courses.filter(c => c.unavailableToGuests).length}/${courses.length}`);
