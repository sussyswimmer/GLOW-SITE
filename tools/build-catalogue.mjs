/* ═══════════════════════════════════════════════════════════
   Turn .gen/crawl/public.json into server/data/glow-catalogue.js.

   The grouping (TED Talks / Pronunciation / ETOP / Testing / Other /
   Educational Resources) is GLOW's own top navigation, in their order —
   it is not a rearrangement. Everything else on each track comes from
   the crawl, so re-running the crawler and then this script is the whole
   update path when Pacific Links changes the platform.

   Anything a guest cannot see stays marked `gated: true` with no invented
   title, summary or artwork.
   ═══════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const crawl = JSON.parse(readFileSync('.gen/crawl/public.json', 'utf8'));
const art = existsSync('.gen/crawl/course-art.json')
  ? JSON.parse(readFileSync('.gen/crawl/course-art.json', 'utf8')) : {};

/* GLOW's navigation, in their order. Ids are theirs. */
const GROUPS = [
  { key: 'ted',           title: 'TED Talks',      titleVi: 'TED Talks',  catalog: 'english',   ids: [1105, 1991, 1992, 1749, 2205, 2219] },
  { key: 'pronunciation', title: 'Pronunciation',  titleVi: 'Phát âm',    catalog: 'english',   ids: [281, 279, 278, 1736] },
  { key: 'etop',          title: 'ETOP',           titleVi: 'ETOP',       catalog: 'english',   ids: [241, 287, 246, 106] },
  { key: 'testing',       title: 'Testing',        titleVi: 'Kiểm tra',   catalog: 'english',   ids: [62, 61, 1734, 2245, 245] },
  { key: 'other',         title: 'Other',          titleVi: 'Khác',       catalog: 'english',   ids: [1753, 1750, 1135, 1128, 60, 1999, 1983, 2005] },
  { key: 'resources',     title: 'Educational Resources', titleVi: 'Tài nguyên giáo dục', catalog: 'resources', ids: [1986, 1987, 579, 2213] },
];

const byId = new Map(crawl.courses.map(c => [c.id, c]));

const clean = s => s && s
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#0?39;|&apos;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const tracks = [];
const missing = [];

for (const g of GROUPS) {
  for (const id of g.ids) {
    const c = byId.get(id);
    if (!c) { missing.push(id); continue; }

    /* "Notice" is Moodle's page title for "unavailable to students" — it is
       not a course name, so it must never reach the catalogue as one. */
    const realTitle = c.title && c.title !== 'Notice' ? clean(c.title) : null;
    const file = art[String(id)]?.file || null;

    tracks.push({
      id,
      group: g.key,
      /* The label GLOW's own menu uses — "Beginner" under "Pronunciation". */
      nav: clean(c.navName),
      /* The course's real full name, where a guest is allowed to see it. */
      title: realTitle,
      category: c.category ? clean(c.category) : null,
      summary: realTitle ? clean(c.summary) : null,
      image: file ? `/assets/img/courses/${file}` : null,
      gated: !realTitle,
      brokenOnGlow: c.navHrefBroken === true || undefined,
      url: `https://glow.mata9.com/course/view.php?id=${id}`,
    });
  }
}

if (missing.length) {
  console.error(`\n!! ${missing.length} grouped ids are not in the crawl: ${missing.join(', ')}`);
  console.error('   Re-run tools/crawl-public.mjs, or the grouping is out of date.\n');
  process.exitCode = 1;
}

const fmt = t => '  ' + JSON.stringify(t)
  .replace(/^\{/, '{ ').replace(/\}$/, ' }')
  .replace(/","/g, '", "');

const out = `/* ═══════════════════════════════════════════════════════════
   GENERATED — do not hand-edit.
     node tools/crawl-public.mjs && node tools/build-catalogue.mjs

   GLOW's real catalogue, harvested from glow.mata9.com without a login.
   Every id, title, category, summary and cover image below came off their
   platform; nothing here is written.

   \`gated: true\` means Moodle answered "This course is currently
   unavailable to students" for an anonymous visitor, so only the
   navigation label is known. Those tracks deliberately carry no title,
   summary or artwork rather than a plausible-looking guess — see
   CONTENT.md, "Still behind the login".

   Crawled: ${crawl.crawledFrom}
   Tracks: ${tracks.length} · readable ${tracks.filter(t => !t.gated).length} · gated ${tracks.filter(t => t.gated).length} · with cover art ${tracks.filter(t => t.image).length}
   ═══════════════════════════════════════════════════════════ */

export const GROUPS = ${JSON.stringify(GROUPS.map(({ ids, ...g }) => g), null, 2).replace(/\n/g, '\n')};

export const TRACKS = [
${tracks.map(fmt).join(',\n')},
];

const byId = new Map(TRACKS.map(t => [t.id, t]));

/** A track by its real Moodle course id, or undefined. */
export function trackById(id) {
  return byId.get(Number(id));
}

/**
 * The catalogue shape the API contract expects: groups of
 * \`{ title, courseId }\`. Chips carry a courseId only when there is a
 * course page worth opening — the front end renders the rest as plainly
 * unavailable instead of as a link to nowhere.
 */
export function catalogGroups(catalog) {
  return GROUPS.filter(g => g.catalog === catalog).map(g => ({
    title: g.title,
    titleVi: g.titleVi,
    items: TRACKS.filter(t => t.group === g.key).map(t => ({
      title: t.nav,
      courseId: t.id,
    })),
  }));
}
`;

writeFileSync('server/data/glow-catalogue.js', out);

console.log(`wrote server/data/glow-catalogue.js`);
console.log(`  tracks       ${tracks.length}`);
console.log(`  readable     ${tracks.filter(t => !t.gated).length}`);
console.log(`  gated        ${tracks.filter(t => t.gated).length}`);
console.log(`  cover art    ${tracks.filter(t => t.image).length}`);
console.log(`  summaries    ${tracks.filter(t => t.summary).length}`);
const broken = tracks.filter(t => t.brokenOnGlow);
if (broken.length) console.log(`  NOTE: broken href on GLOW's own menu: ${broken.map(t => `${t.nav} (#${t.id})`).join(', ')}`);
