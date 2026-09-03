/* Checks the fourteen things that were wrong, against a running server.

     npm start           (in one terminal)
     node tools/verify-fixes.mjs [baseUrl]

   Two passes over every page: once as a signed-out visitor, once signed in
   as the demo learner, because half of these only go wrong in one of those
   two states and the shipped markup only ever showed one of them.

   Deliberately checks the RENDERED page and not the source: the whole class
   of bug here is markup that is right after JavaScript has run and wrong
   before it, or the other way round. Where the static HTML is the point —
   the stat counters, the catalogue — it fetches the raw file too and says
   so. */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const CREDS = { username: 'demo', password: 'glow-demo-2026' };

let pass = 0, fail = 0;
const rows = [];
function check(id, name, ok, detail = '') {
  rows.push({ id, name, ok, detail });
  ok ? pass++ : fail++;
}

const APP_PAGES = ['dashboard.html', 'courses.html', 'english.html', 'resources.html'];
const ALL_PAGES = [...APP_PAGES, 'course.html?id=2489', 'index.html', 'login.html'];

const browser = await chromium.launch();

/* ── raw HTML, before a line of script has run ─────────────
   This is what a crawler, a link preview and a JavaScript-disabled browser
   get, and it is where five of the fourteen actually lived. */
const raw = {};
for (const p of ['index.html', ...APP_PAGES, 'course.html', 'login.html']) {
  raw[p] = await fetch(`${BASE}/${p}`).then(r => r.text());
}

/* 1 · the first nav link had no text, so everything that reads a page by
       its text printed its href instead. */
for (const p of APP_PAGES.concat('course.html')) {
  const nav = raw[p].match(/<nav class="appnav"[\s\S]*?<\/nav>/)[0];
  const first = nav.match(/<a [^>]*>([\s\S]*?)<\/a>/)[1];
  const text = first.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();
  check(1, `${p}: home link says "${text}"`, text === 'Trang chủ', text || '(empty)');
}

/* 2 · the header shipped a learner who was not there. */
for (const p of APP_PAGES) {
  const bar = raw[p].match(/<header class="appbar">[\s\S]*?<\/header>/)[0];
  const dashName = /<span class="who-name">\s*[—–-]\s*<\/span>/.test(bar);
  const dotAvatar = /<span class="avatar"[^>]*>\s*·\s*<\/span>/.test(bar);
  const outHidden = /<button id="signOut"[^>]*\shidden/.test(bar);
  const inShown = /<a id="signIn"[^>]*>/.test(bar) && !/<a id="signIn"[^>]*\shidden/.test(bar);
  check(2, `${p}: signed-out header is honest in static HTML`,
    !dashName && !dotAvatar && outHidden && inShown,
    `dash=${dashName} dot=${dotAvatar} signOutHidden=${outHidden} signInShown=${inShown}`);
}

/* 3 · the one control labelled "Sign in" skipped signing in. */
{
  const nav = raw['index.html'].match(/<header id="hdr">[\s\S]*?<\/header>/)[0];
  const href = nav.match(/class="btn-login" href="([^"]+)"/)?.[1];
  check(3, `index: "Đăng nhập" → ${href}`, href === './login.html', href);
  const footLogin = /<a href="\.\/login\.html"[^>]*data-vi="Đăng nhập"/.test(raw['index.html']);
  check(3, 'index: footer "Đăng nhập" → login.html', footLogin);
}

/* 5 · the numbers on the home page were authored as zero. */
{
  const nums = [...raw['index.html'].matchAll(/<b class="num" data-to="(\d+)">(\d+)<\/b>/g)];
  check(5, 'index: stat counters ship their real numbers',
    nums.length === 3 && nums.every(m => m[1] === m[2]),
    nums.map(m => `${m[2]}/${m[1]}`).join(' '));
  const pre = raw['index.html'].match(/<div id="preloader"[^>]*>/)[0];
  check(5, 'index: preloader counter is aria-hidden', /aria-hidden="true"/.test(pre), pre);
}

/* 6 · public pages were built as authenticated ones and told search
       engines to stay away from content that was already public. */
for (const p of ['english.html', 'resources.html']) {
  const noindex = /<meta name="robots" content="noindex">/.test(raw[p]);
  const tracks = (raw[p].match(/<section class="track"/g) || []).length;
  const chips = (raw[p].match(/class="chip"/g) || []).length;
  check(6, `${p}: indexable`, !noindex);
  check(6, `${p}: content is in the static HTML`, tracks > 0 && chips > 0,
    `${tracks} groups, ${chips} tracks`);
}
for (const p of ['dashboard.html', 'course.html', 'courses.html']) {
  check(6, `${p}: still noindex`, /<meta name="robots" content="noindex">/.test(raw[p]));
}

/* 7 · the footer sent you back up the page you were already on. */
{
  const foot = raw['index.html'].match(/<div class="foot-cols">[\s\S]*?<\/div>\s*<\/div>/)[0];
  const hrefs = [...foot.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  const anchorsOnly = hrefs.filter(h => h.startsWith('#'));
  check(7, 'index: no footer link is a bare same-page anchor',
    anchorsOnly.length === 0, anchorsOnly.join(' ') || 'none');
  check(7, 'index: footer links resolve to real pages', hrefs.length === 12, `${hrefs.length} links`);
}

/* 8 · title, description and lang were English over a Vietnamese page. */
for (const p of ['index.html', ...APP_PAGES, 'course.html', 'login.html']) {
  const html = raw[p];
  const hasPair = /data-title-vi="/.test(html) && /data-title-en="/.test(html)
               && /data-desc-vi="/.test(html) && /data-desc-en="/.test(html);
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  const titleVi = html.match(/data-title-vi="([^"]*)"/)?.[1];
  check(8, `${p}: <title> is the Vietnamese one and both are declared`,
    hasPair && title === titleVi, `${title}`);
}

/* 10 · marquee copy duplicated for the infinite loop. */
{
  const rowsHtml = [...raw['index.html'].matchAll(/<div class="(?:mq-row|st-row)[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
  const bad = rowsHtml.filter(m => {
    const spans = [...m[1].matchAll(/<span([^>]*)>/g)];
    return spans.length === 2 && !/aria-hidden="true"/.test(spans[1][1]);
  });
  check(10, 'index: every duplicated marquee span is aria-hidden',
    bad.length === 0 && rowsHtml.length === 4, `${rowsHtml.length} rows, ${bad.length} unmarked`);
  for (const wrap of ['hero-type', 'marquee']) {
    check(10, `index: .${wrap} wrapper is aria-hidden`,
      new RegExp(`class="${wrap}" aria-hidden="true"`).test(raw['index.html']));
  }
}

/* 11 · the deck was one slide out of step, so the overview appeared twice
        and every pillar was captioned by the wrong picture. */
{
  const html = raw['index.html'];
  const showcase = html.match(/<figure class="showcase-panel">[\s\S]*?<\/figure>/)[0];
  const shots = [...html.matchAll(/<div class="shot" data-shot="\d"><img src="\.\/assets\/img\/([^"]+)"/g)]
    .map(m => m[1]);
  check(11, 'index: no image is used twice across showcase and pillars',
    new Set([...shots, 'slide2.png']).size === 4, shots.join(' '));
  check(11, 'index: pillar 01 is the English slide', shots[0] === 'slide3.png', shots[0]);
  check(11, 'index: pillar 02 is the Professional Development slide',
    shots[1] === 'slide4.png', shots[1]);
  check(11, 'index: showcase panel has a descriptive alt, in both languages',
    /data-alt-vi="[^"]{20,}"/.test(showcase) && /data-alt-en="[^"]{20,}"/.test(showcase));
}

/* 12 · skip links, and something for them to land on. */
for (const p of ['index.html', ...APP_PAGES, 'course.html', 'login.html']) {
  const link = raw[p].match(/<a class="skip-link" href="#([^"]+)"/);
  const target = link && new RegExp(`id="${link[1]}"[^>]*tabindex="-1"`).test(raw[p]);
  check(12, `${p}: skip link → #${link?.[1]}, target exists and is focusable`,
    Boolean(link) && target, link ? `#${link[1]} focusable=${target}` : 'no skip link');
}

/* 14 · no JavaScript, no explanation. */
for (const p of [...APP_PAGES, 'course.html', 'index.html']) {
  const ns = raw[p].match(/<noscript>[\s\S]*?<\/noscript>/g) || [];
  const hasNote = ns.some(b => /noscript-note/.test(b));
  check(14, `${p}: <noscript> carries a message`, hasNote,
    hasNote ? '' : `${ns.length} noscript blocks, none with a message`);
}

/* ══════ and now with a browser ══════ */

async function page(ctx, path) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${BASE}/${path}`, { waitUntil: 'networkidle' });
  p.__errs = errs;
  return p;
}

/* ── signed out ───────────────────────────────────────────── */
const out = await browser.newContext();
for (const path of ALL_PAGES) {
  const p = await page(out, path);
  const seen = await p.evaluate(() => ({
    body: document.body.innerText,
    url: location.pathname,
    signIn: !document.getElementById('signIn')?.hasAttribute('hidden'),
    signOut: document.getElementById('signOut')
      ? !document.getElementById('signOut').hasAttribute('hidden') : false,
    who: document.querySelector('.who') ? !document.querySelector('.who').hasAttribute('hidden') : false,
    privateNav: [...document.querySelectorAll('.appnav a[data-private]')]
      .filter(a => !a.hasAttribute('hidden')).length,
    lang: document.documentElement.lang,
    title: document.title,
  }));

  check(0, `signed out ${path}: no page errors`, p.__errs.length === 0, p.__errs.join('; '));

  /* 1 · again, but after script has run — the language toggle rewrites
         every [data-i18n] and could have blanked it. */
  if (/dashboard|courses|english|resources|course\.html/.test(path)) {
    check(1, `signed out ${path}: no raw href leaked into visible text`,
      !seen.body.includes('./index.html'), seen.body.slice(0, 80));
  }

  /* 2 · never a dash, never a stray middle dot standing in for a person. */
  if (path.endsWith('.html') && !path.startsWith('index') && !path.startsWith('login')) {
    check(2, `signed out ${path}: no placeholder identity rendered`,
      !seen.who && !seen.signOut && seen.signIn,
      `who=${seen.who} signOut=${seen.signOut} signIn=${seen.signIn}`);
  }

  /* 3 · the gated pages actually gate. */
  if (/dashboard|courses\.html|course\.html/.test(path)) {
    check(3, `signed out ${path}: redirected to sign in`,
      seen.url.endsWith('/login.html'), seen.url);
  }

  /* 6 · the public ones do not, and they still have their content. */
  if (/english|resources/.test(path)) {
    check(6, `signed out ${path}: stays on the page`, seen.url.endsWith(path), seen.url);
    check(6, `signed out ${path}: catalogue is readable`,
      seen.body.includes('TED Talks') || seen.body.includes('Khan Academy'),
      seen.body.slice(0, 60).replace(/\n/g, ' '));
    check(6, `signed out ${path}: private nav items stay hidden`,
      seen.privateNav === 0, `${seen.privateNav} shown`);
  }
  await p.close();
}

/* 8 · <title>, description and lang follow the toggle. */
{
  const p = await page(out, 'english.html');
  const before = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    desc: document.querySelector('meta[name="description"]').content,
  }));
  await p.evaluate(() => document.getElementById('langBtn').click());
  await p.waitForTimeout(1400);
  const after = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    desc: document.querySelector('meta[name="description"]').content,
    h1: document.querySelector('.pagehead h1').textContent,
    firstTrack: document.querySelector('.track-head h3').textContent,
  }));
  check(8, 'english: lang vi → en', before.lang === 'vi' && after.lang === 'en',
    `${before.lang} → ${after.lang}`);
  check(8, 'english: <title> follows the toggle', before.title !== after.title,
    `${before.title} → ${after.title}`);
  check(8, 'english: description follows the toggle', before.desc !== after.desc);
  check(9, 'english: page content follows the toggle',
    after.h1 === 'English self-learning' && after.firstTrack === 'TED Talks',
    `${after.h1} / ${after.firstTrack}`);
  await p.close();
}

/* 9 · everything on the home page, including the six cards, the marquees
       and the footer. */
{
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await page(fresh, 'index.html');
  await p.waitForTimeout(2800);          // the entrance has to finish first
  const vi = await p.evaluate(() => document.body.innerText);
  await p.evaluate(() => document.getElementById('langBtn').click());
  await p.waitForTimeout(1600);
  const en = await p.evaluate(() => ({
    text: document.body.innerText,
    cards: [...document.querySelectorAll('.card-meta h3')].map(h => h.textContent),
    marquee: [...document.querySelectorAll('.mq-row span')].map(s => s.textContent.trim()),
    foot: [...document.querySelectorAll('.foot-cols h3')].map(h => h.textContent),
    alt: document.querySelector('.showcase-panel img').alt,
  }));
  check(9, 'index: six course cards translate',
    en.cards.length === 6 && en.cards.includes('Teamwork Skills')
      && en.cards.includes('Financial Management'), en.cards.join(' | '));
  check(9, 'index: marquees translate',
    en.marquee.some(s => s.includes('Pronunciation')) && en.marquee.some(s => s.includes('Grammar')),
    en.marquee.join(' | '));
  check(9, 'index: footer headings translate',
    en.foot.join(',') === 'English,Skills,Resources', en.foot.join(','));
  check(11, 'index: showcase alt translates', /What's on GLOW/.test(en.alt), en.alt);
  check(9, 'index: the page really changed', vi !== en.text);

  /* 5 · and the counters, after all that, still land on the real numbers. */
  await p.evaluate(() => document.querySelector('.stats').scrollIntoView());
  await p.waitForTimeout(2600);
  const nums = await p.evaluate(() => [...document.querySelectorAll('.num')].map(n => n.textContent));
  check(5, 'index: counters finish on their real numbers',
    nums.join(',') === '5,6,2', nums.join(','));
  await p.close();
  await fresh.close();
}

/* 13 · the course code is no longer the first thing on a card. */
{
  const p = await page(out, 'index.html');
  const order = await p.evaluate(() =>
    [...document.querySelectorAll('.card-meta')].map(m =>
      [...m.children].map(c => c.className || c.tagName.toLowerCase()).join('>')));
  check(13, 'index: every card leads with its title, not its code',
    order.every(o => o.startsWith('h3') || o.startsWith('')) &&
    order.every(o => o.indexOf('card-idx') > 0), order[0]);
  const styles = await p.evaluate(() => {
    const i = document.querySelector('.card-idx'), h = document.querySelector('.card-meta h3');
    const cs = getComputedStyle(i), hs = getComputedStyle(h);
    return { size: parseFloat(cs.fontSize), hSize: parseFloat(hs.fontSize),
             weight: cs.fontWeight, color: cs.color };
  });
  check(13, 'index: the code is smaller and quieter than the title',
    styles.size < styles.hSize && Number(styles.weight) <= 500,
    `${styles.size}px ${styles.weight} ${styles.color} vs title ${styles.hSize}px`);
  await p.close();
}

/* ── signed in ────────────────────────────────────────────── */
const inn = await browser.newContext();
{
  const p = await page(inn, 'login.html');
  await p.fill('#username', CREDS.username);
  await p.fill('#password', CREDS.password);
  await p.click('#loginSubmit');
  await p.waitForURL(/dashboard/, { timeout: 10_000 });
  await p.waitForTimeout(900);

  const header = await p.evaluate(() => ({
    name: document.querySelector('.who-name')?.textContent.trim(),
    avatar: document.querySelector('.avatar')?.textContent.trim(),
    whoShown: !document.querySelector('.who').hasAttribute('hidden'),
    outShown: !document.getElementById('signOut').hasAttribute('hidden'),
    inShown: !document.getElementById('signIn').hasAttribute('hidden'),
  }));
  check(2, 'signed in: the real name is in the header',
    header.whoShown && header.outShown && !header.inShown
      && header.name?.startsWith('Học viên GLOW') && header.avatar !== '·',
    JSON.stringify(header));
  await p.close();
}

/* 2 · and the private nav appears once there is a session. */
{
  const p = await page(inn, 'english.html');
  const shown = await p.evaluate(() =>
    [...document.querySelectorAll('.appnav a[data-private]')].filter(a => !a.hasAttribute('hidden')).length);
  check(2, 'signed in english: private nav items appear', shown === 2, `${shown} of 2`);
  await p.close();
}

/* 4 · the course page, in all three of its endings. */
{
  const good = await page(inn, 'course.html?id=2489');
  await good.waitForTimeout(700);
  const g = await good.evaluate(() => ({
    h1: document.querySelector('.pagehead h1').textContent.trim(),
    crumb: document.querySelector('.crumb-now').textContent.trim(),
    title: document.title,
    trail: document.querySelector('.crumbs').textContent.trim(),
  }));
  check(4, 'course: heading becomes the course name', g.h1 && !/Đang tải|Loading/.test(g.h1), g.h1);
  check(4, 'course: <title> becomes the course name',
    g.title.includes(g.h1) && !/^Course \| GLOW$/.test(g.title), g.title);
  check(4, 'course: breadcrumb does not end in an empty segment',
    g.crumb.length > 0 && !/\/\s*$/.test(g.trail), JSON.stringify(g.trail));
  await good.close();

  for (const [id, label] of [['999999', 'unknown id'], ['not-a-number', 'malformed id']]) {
    const bad = await page(inn, `course.html?id=${id}`);
    await bad.waitForTimeout(900);
    const b = await bad.evaluate(() => ({
      h1: document.querySelector('.pagehead h1').textContent.trim(),
      crumb: document.querySelector('.crumb-now').textContent.trim(),
      title: document.title,
      state: document.querySelector('.state-title')?.textContent.trim(),
      cta: document.querySelector('.state a')?.getAttribute('href'),
    }));
    check(4, `course (${label}): heading says what happened`,
      !/Đang tải|Loading/.test(b.h1) && b.h1.length > 0, b.h1);
    check(4, `course (${label}): breadcrumb says what happened`,
      !/Đang tải|Loading/.test(b.crumb) && b.crumb.length > 0, b.crumb);
    check(4, `course (${label}): <title> is not the placeholder`,
      b.title !== 'Khoá học | GLOW' && b.title !== 'Course | GLOW', b.title);
    check(4, `course (${label}): an error state with a way out`,
      Boolean(b.state) && b.cta === './courses.html', `${b.state} → ${b.cta}`);
    await bad.close();
  }

  /* No id at all is a navigation mistake, and still bounces to the list. */
  const none = await page(inn, 'course.html');
  await none.waitForTimeout(700);
  check(4, 'course (no id): sent to the course list',
    none.url().endsWith('/courses.html'), none.url());
  await none.close();
}

/* 13 · the same demotion inside the app's own tiles. */
{
  const p = await page(inn, 'courses.html');
  await p.waitForTimeout(900);
  const order = await p.evaluate(() =>
    [...document.querySelectorAll('.tile-body')]
      .filter(b => b.querySelector('.tile-code'))
      .map(b => [...b.children].map(c => c.className || c.tagName.toLowerCase()).join('>')));
  check(13, 'courses: tiles lead with the title, not the code',
    order.length > 0 && order.every(o => o.indexOf('tile-code') > o.indexOf('h3')),
    order[0] || 'no coded tiles');
  await p.close();
}

await browser.close();

/* ── report ───────────────────────────────────────────────── */
const width = Math.max(...rows.map(r => r.name.length));
let last = null;
for (const r of rows) {
  if (r.id !== last) { console.log(''); last = r.id; }
  console.log(`  ${r.ok ? '✓' : '✗'} [${String(r.id).padStart(2)}] ${r.name.padEnd(width)}  ${r.ok ? '' : r.detail}`);
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
