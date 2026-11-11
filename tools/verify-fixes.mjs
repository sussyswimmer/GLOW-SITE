/* Checks the fourteen things that were wrong, plus the brief's Resources links, against a running server.

     npm start           (in one terminal)
     node tools/verify-fixes.mjs [baseUrl]

   Two passes over every page: once as a signed-out visitor, once signed in
   as the demo learner, because half of these only go wrong in one of those
   two states and the shipped markup only ever showed one of them.

   Deliberately checks the RENDERED page and not the source: the whole class
   of bug here is markup that is right after JavaScript has run and wrong
   before it, or the other way round. Where the static HTML is the point —
   the stat counters, the catalogue — it fetches the raw file too and says
   so.

   Retargeted for the content-brief rebuild (.omc/plans/content-brief-rebuild.md):
   english.html is now category sections of course cards (.catsec / .ccard),
   courses.html is the public all-courses page, the nav is Home · Dashboard ·
   Courses ▼ · Tuition with the Dashboard link always visible, and course
   pages are ?code= (public) or ?id= (private). Every lookup below is
   null-safe: a missing element fails its own check, it does not end the run. */

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const LEARNER = { username: 'demo', password: 'glow-demo-2026' };
const STAFF = { username: 'demo-staff', password: 'glow-staff-2026' };

let pass = 0, fail = 0;
const rows = [];
function check(id, name, ok, detail = '') {
  rows.push({ id, name, ok: Boolean(ok), detail });
  ok ? pass++ : fail++;
}

/* A block that throws is one failed check, not a dead run. */
async function guarded(id, name, fn) {
  try { await fn(); } catch (e) { check(id, `${name}: ran to the end`, false, String(e.message || e).split('\n')[0]); }
}

/* First match of a regex in a string, or '' — never a TypeError. */
const grab = (text, re) => text.match(re)?.[0] ?? '';
const strip = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();

/* Every page that wears the app header. */
const SHELL_PAGES = ['dashboard.html', 'courses.html', 'english.html', 'skills.html',
                     'payment.html', 'resources.html', 'training.html'];
/* The ones whose catalogue is public, with a word that must be readable signed out. */
const PUBLIC_CATALOGUE = {
  'courses.html': 'IELTS',
  'english.html': 'TED Talks',
  'skills.html': 'CoffeeTime',
  'resources.html': 'Khan Academy',
};
const ALL_PAGES = [...SHELL_PAGES, 'course.html?id=2489', 'course.html?code=EL1001', 'index.html', 'login.html'];
const RAW_PAGES = ['index.html', ...SHELL_PAGES, 'course.html', 'login.html'];

const browser = await chromium.launch();

/* ── raw HTML, before a line of script has run ─────────────
   This is what a crawler, a link preview and a JavaScript-disabled browser
   get, and it is where five of the fourteen actually lived. */
const raw = {};
for (const p of RAW_PAGES) {
  raw[p] = await fetch(`${BASE}/${p}`).then(r => r.text()).catch(() => '');
}

/* 1 · the first nav link had no text, so everything that reads a page by
       its text printed its href instead. */
for (const p of SHELL_PAGES.concat('course.html')) {
  const nav = grab(raw[p], /<nav class="appnav"[\s\S]*?<\/nav>/);
  const first = nav.match(/<a [^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '';
  const text = strip(first);
  check(1, `${p}: home link says "${text}"`, text === 'Trang chủ', text || '(empty)');
}

/* 2 · the header shipped a learner who was not there. The brief's chip reads
       "<code> <full name>" once signed in, so the signed-out markup must have
       the chip hidden and EMPTY (no dash, no middle dot standing in for a person). */
for (const p of SHELL_PAGES) {
  const bar = grab(raw[p], /<header class="appbar">[\s\S]*?<\/header>/);
  const whoHidden = /<a class="who"[^>]*\shidden/.test(bar);
  const nameText = strip(bar.match(/<span class="who-name">([\s\S]*?)<\/span>/)?.[1] ?? '?');
  const avatarText = strip(bar.match(/<span class="avatar"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '?');
  const outHidden = /<button id="signOut"[^>]*\shidden/.test(bar);
  const inShown = /<a id="signIn"[^>]*>/.test(bar) && !/<a id="signIn"[^>]*\shidden/.test(bar);
  check(2, `${p}: signed-out header is honest in static HTML`,
    whoHidden && nameText === '' && avatarText === '' && outHidden && inShown,
    `whoHidden=${whoHidden} name="${nameText}" avatar="${avatarText}" signOutHidden=${outHidden} signInShown=${inShown}`);
}

/* 3 · the one control labelled "Sign in" skipped signing in. */
{
  const head = grab(raw['index.html'], /<header id="hdr">[\s\S]*?<\/header>/);
  const loginTag = grab(head, /<a [^>]*btn-login[^>]*>/);
  const href = loginTag.match(/href="([^"]+)"/)?.[1];
  check(3, `index: "Đăng nhập" → ${href}`, href === './login.html', href);
  const footLogin = /<a href="\.\/login\.html"[^>]*data-vi="Đăng nhập"/.test(raw['index.html']);
  check(3, 'index: footer "Đăng nhập" → login.html', footLogin);
}

/* 5 · the numbers on the home page were authored as zero. */
const staticNums = [...raw['index.html'].matchAll(/<b class="num" data-to="(\d+)">(\d+)<\/b>/g)];
{
  check(5, 'index: stat counters ship their real numbers',
    staticNums.length === 3 && staticNums.every(m => m[1] === m[2] && Number(m[1]) > 0),
    staticNums.map(m => `${m[2]}/${m[1]}`).join(' '));
  const pre = grab(raw['index.html'], /<div id="preloader"[^>]*>/);
  check(5, 'index: preloader counter is aria-hidden', /aria-hidden="true"/.test(pre), pre || '(no preloader)');
}

/* 6 · public pages were built as authenticated ones and told search
       engines to stay away from content that was already public.
       english / skills / courses carry the brief's course cards (.ccard) in
       .catsec / .cgroup-block sections; resources is still the old chip list. */
const noindexRe = /<meta name="robots" content="noindex">/;
for (const p of ['english.html', 'skills.html', 'courses.html']) {
  const groups = (raw[p].match(/<section class="(?:catsec|cgroup-block)/g) || []).length;
  const cards = (raw[p].match(/class="ccard"/g) || []).length;
  check(6, `${p}: indexable`, raw[p] && !noindexRe.test(raw[p]));
  check(6, `${p}: content is in the static HTML`, groups > 0 && cards > 0,
    `${groups} groups, ${cards} course cards`);
}
{
  const tracks = (raw['resources.html'].match(/<section class="track"/g) || []).length;
  const chips = (raw['resources.html'].match(/class="chip"/g) || []).length;
  check(6, 'resources.html: indexable', raw['resources.html'] && !noindexRe.test(raw['resources.html']));
  check(6, 'resources.html: content is in the static HTML', tracks > 0 && chips > 0,
    `${tracks} groups, ${chips} chips`);
}
/* course.html (the shell: ?id= is private) and dashboard stay noindex; training is
   the staff panel (brief rows 178-179: noindex, no course data in static markup).
   courses.html is NOT here any more: the brief made it the public catalogue. */
for (const p of ['dashboard.html', 'course.html', 'training.html']) {
  check(6, `${p}: still noindex`, noindexRe.test(raw[p]));
}
check(6, 'training.html: no course cards in the static markup', !/class="ccard"/.test(raw['training.html']));

/* 7 · the footer sent you back up the page you were already on. */
{
  const foot = grab(raw['index.html'], /<div class="foot-cols">[\s\S]*?<\/div>\s*<\/div>/);
  const hrefs = [...foot.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  const anchorsOnly = hrefs.filter(h => h.startsWith('#'));
  check(7, 'index: no footer link is a bare same-page anchor',
    foot !== '' && anchorsOnly.length === 0, anchorsOnly.join(' ') || (foot ? 'none' : 'no footer'));
  /* 19 = English 4 + Skills 4 + staff Training 4 + Other 7 (was 12 before the brief). */
  const shaped = hrefs.every(h => /^\.\/[a-z-]+\.html(#[\w-]+)?$/.test(h) || /^https:\/\//.test(h));
  check(7, 'index: footer links resolve to real pages', hrefs.length === 19 && shaped,
    `${hrefs.length} links${shaped ? '' : ', some malformed'}`);
  /* A fragment into a page that has no such id lands you at the top of it. */
  const dangling = hrefs.filter(h => {
    const m = h.match(/^\.\/(index|english|skills)\.html#([\w-]+)$/);
    return m && !new RegExp(`id="${m[2]}"`).test(raw[`${m[1]}.html`] || '');
  });
  check(7, 'index: every footer fragment lands on an element that exists',
    dangling.length === 0, dangling.join(' ') || 'none');
}

/* 8 · title, description and lang were English over a Vietnamese page. */
for (const p of RAW_PAGES) {
  const html = raw[p];
  const hasPair = /data-title-vi="/.test(html) && /data-title-en="/.test(html)
               && /data-desc-vi="/.test(html) && /data-desc-en="/.test(html);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const titleVi = html.match(/data-title-vi="([^"]*)"/)?.[1];
  check(8, `${p}: <title> is the Vietnamese one and both are declared`,
    hasPair && title !== undefined && title === titleVi, `${title}`);
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
        and every pillar was captioned by the wrong picture. The pillar copy
        changed with the brief (02 is now Skills & Network Building, which
        holds the career track); the pictures did not. */
{
  const html = raw['index.html'];
  const showcase = grab(html, /<figure class="showcase-panel">[\s\S]*?<\/figure>/);
  const shots = [...html.matchAll(/<div class="shot" data-shot="\d"><img src="\.\/assets\/img\/([^"]+)"/g)]
    .map(m => m[1]);
  const pillars = [...html.matchAll(/<article class="chap"[\s\S]*?<h2[^>]*>([^<]*)/g)].map(m => m[1]);
  check(11, 'index: no image is used twice across showcase and pillars',
    shots.length === 3 && new Set([...shots, 'slide2.png']).size === 4, shots.join(' '));
  check(11, 'index: pillar 01 is the English slide',
    shots[0] === 'slide3.png' && pillars[0] === 'Học tiếng Anh', `${shots[0]} / ${pillars[0]}`);
  check(11, 'index: pillar 02 (Skills & Network Building) is the Professional Development slide',
    shots[1] === 'slide4.png' && /Kỹ năng/.test(pillars[1] || ''), `${shots[1]} / ${pillars[1]}`);
  check(11, 'index: showcase panel has a descriptive alt, in both languages',
    /data-alt-vi="[^"]{20,}"/.test(showcase) && /data-alt-en="[^"]{20,}"/.test(showcase));
}

/* 12 · skip links, and something for them to land on. */
for (const p of RAW_PAGES) {
  const link = raw[p].match(/<a class="skip-link" href="#([^"]+)"/);
  const target = link && new RegExp(`id="${link[1]}"[^>]*tabindex="-1"`).test(raw[p]);
  check(12, `${p}: skip link → #${link?.[1]}, target exists and is focusable`,
    Boolean(link) && Boolean(target), link ? `#${link[1]} focusable=${Boolean(target)}` : 'no skip link');
}

/* 14 · no JavaScript, no explanation. */
for (const p of [...SHELL_PAGES, 'course.html', 'index.html']) {
  const ns = raw[p].match(/<noscript>[\s\S]*?<\/noscript>/g) || [];
  const hasNote = ns.some(b => /noscript-note/.test(b));
  check(14, `${p}: <noscript> carries a message`, hasNote,
    hasNote ? '' : `${ns.length} noscript blocks, none with a message`);
}

/* The new course card: name first, then the code chip, then the category
   (brief section "Shared course card markup"). The static markup is checked
   here, the rendered one below. */
{
  const cards = [...raw['courses.html'].matchAll(/<a class="ccard"[^>]*>\s*<span class="(ccard-[a-z]+)"/g)].map(m => m[1]);
  check(13, 'courses (static): every course card leads with its name, not its code',
    cards.length > 0 && cards.every(c => c === 'ccard-name'),
    cards.length ? `first child: ${[...new Set(cards)].join(',')}` : 'no cards');
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

/* The order of a card's children, e.g. ['ccard-name','ccard-top','ccard-cat'].
   Runs in the page, so it is a string of code, not a closure. */
const cardOrder = () => [...document.querySelectorAll('.ccard')]
  .map(c => [...c.children].map(x => x.className));

/* ── signed out ───────────────────────────────────────────── */
const out = await browser.newContext();
for (const path of ALL_PAGES) {
  await guarded(0, `signed out ${path}`, async () => {
    const p = await page(out, path);
    const seen = await p.evaluate(() => ({
      body: document.body?.innerText ?? '',
      url: location.pathname + location.search,
      signIn: !document.getElementById('signIn')?.hasAttribute('hidden'),
      signOut: document.getElementById('signOut')
        ? !document.getElementById('signOut').hasAttribute('hidden') : false,
      who: document.querySelector('.who') ? !document.querySelector('.who').hasAttribute('hidden') : false,
      staffShown: [...document.querySelectorAll('[data-staff]')].filter(n => !n.hidden).length,
    }));

    check(0, `signed out ${path}: no page errors`, p.__errs.length === 0, p.__errs.join('; '));

    /* 1 · again, but after script has run — the language toggle rewrites
           every [data-i18n] and could have blanked it. */
    if (SHELL_PAGES.concat('course.html').some(s => path.startsWith(s))) {
      check(1, `signed out ${path}: no raw href leaked into visible text`,
        !seen.body.includes('./index.html'), seen.body.slice(0, 80));
    }

    /* 2 · never a dash, never a stray middle dot standing in for a person. */
    if (!/^(index|login)/.test(path)) {
      check(2, `signed out ${path}: no placeholder identity rendered`,
        !seen.who && !seen.signOut && seen.signIn,
        `who=${seen.who} signOut=${seen.signOut} signIn=${seen.signIn}`);
    }

    /* 3 · the gated pages actually gate. The Dashboard link stays in the public
           menu (the brief keeps it there), so what makes it honest is that
           following it signed out lands on sign in (now with ?next=&reason=required,
           so the check reads the path, not the whole URL). */
    if (/^dashboard|^course\.html\?id=/.test(path)) {
      check(3, `signed out ${path}: redirected to sign in`,
        seen.url.split('?')[0].endsWith('/login.html'), seen.url);
    }

    /* 6 · the public ones do not, and they still have their content. */
    if (PUBLIC_CATALOGUE[path]) {
      check(6, `signed out ${path}: stays on the page`, seen.url.endsWith(path), seen.url);
      check(6, `signed out ${path}: catalogue is readable`,
        seen.body.includes(PUBLIC_CATALOGUE[path]), seen.body.slice(0, 60).replace(/\n/g, ' '));
      /* Was "private nav items stay hidden". The brief removed the private nav
         items (Dashboard is always shown); the thing still worth guarding is
         that the staff-only items do not leak to a visitor. */
      check(6, `signed out ${path}: staff-only items stay hidden`,
        seen.staffShown === 0, `${seen.staffShown} shown`);
    }
    /* A public course page by code is readable without a session. */
    if (path.startsWith('course.html?code=')) {
      check(6, `signed out ${path}: stays on the page`, seen.url === `/${path}`, seen.url);
    }
    await p.close();
  });
}

/* 8 · <title>, description and lang follow the toggle. */
await guarded(8, 'english toggle', async () => {
  const p = await page(out, 'english.html');
  const read = () => p.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.content ?? '',
    h1: document.querySelector('.pagehead h1')?.textContent ?? '',
    firstSection: document.querySelector('.catsec h2')?.textContent.trim() ?? '',
  }));
  const before = await read();
  await p.evaluate(() => document.getElementById('langBtn')?.click());
  await p.waitForTimeout(1400);
  const after = await read();
  check(8, 'english: lang vi → en', before.lang === 'vi' && after.lang === 'en',
    `${before.lang} → ${after.lang}`);
  check(8, 'english: <title> follows the toggle', before.title !== after.title,
    `${before.title} → ${after.title}`);
  check(8, 'english: description follows the toggle', before.desc !== '' && before.desc !== after.desc);
  check(9, 'english: page content follows the toggle',
    after.h1 === 'English Learning' && after.firstSection === 'English Testing',
    `${after.h1} / ${after.firstSection}`);
  await p.close();
});

/* 9 · everything on the home page, including the six cards, the marquees
       and the footer. */
await guarded(9, 'index toggle', async () => {
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await page(fresh, 'index.html');
  await p.waitForTimeout(2800);          // the entrance has to finish first
  const vi = await p.evaluate(() => document.body.innerText);
  await p.evaluate(() => document.getElementById('langBtn')?.click());
  await p.waitForTimeout(1600);
  const en = await p.evaluate(() => ({
    text: document.body.innerText,
    cards: [...document.querySelectorAll('.card-meta h3')].map(h => h.textContent),
    marquee: [...document.querySelectorAll('.mq-row span')].map(s => s.textContent.trim()),
    foot: [...document.querySelectorAll('.foot-cols h3')].map(h => h.textContent),
    alt: document.querySelector('.showcase-panel img')?.alt ?? '',
  }));
  check(9, 'index: six course cards translate',
    en.cards.length === 6 && en.cards.includes('Teamwork Skills')
      && en.cards.includes('Financial Management'), en.cards.join(' | '));
  check(9, 'index: marquees translate',
    en.marquee.some(s => s.includes('Pronunciation')) && en.marquee.some(s => s.includes('Grammar')),
    en.marquee.join(' | '));
  /* Four columns now; "Training" is the staff-only one (hidden, still translated). */
  check(9, 'index: footer headings translate',
    en.foot.join(',') === 'English Learning,Skills & Network Building,Training,Other', en.foot.join(','));
  check(11, 'index: showcase alt translates', /What's on GLOW/.test(en.alt), en.alt);
  check(9, 'index: the page really changed', vi !== en.text);

  /* 5 · and the counters, after all that, still land on the real numbers —
         the ones the static HTML shipped. */
  await p.evaluate(() => document.querySelector('.stats')?.scrollIntoView());
  await p.waitForTimeout(2600);
  const nums = await p.evaluate(() => [...document.querySelectorAll('.num')].map(n => n.textContent));
  check(5, 'index: counters finish on their real numbers',
    nums.length === 3 && nums.join(',') === staticNums.map(m => m[1]).join(','), nums.join(','));
  await p.close();
  await fresh.close();
});

/* 13 · the course code is no longer the first thing on a card. */
await guarded(13, 'index cards', async () => {
  const p = await page(out, 'index.html');
  const order = await p.evaluate(() =>
    [...document.querySelectorAll('.card-meta')].map(m =>
      [...m.children].map(c => c.className || c.tagName.toLowerCase()).join('>')));
  check(13, 'index: every card leads with its title, not its code',
    order.length > 0 && order.every(o => o.startsWith('h3') && o.indexOf('card-idx') > 0), order[0] ?? 'no cards');
  const styles = await p.evaluate(() => {
    const i = document.querySelector('.card-idx'), h = document.querySelector('.card-meta h3');
    if (!i || !h) return null;
    const cs = getComputedStyle(i), hs = getComputedStyle(h);
    return { size: parseFloat(cs.fontSize), hSize: parseFloat(hs.fontSize),
             weight: cs.fontWeight, color: cs.color };
  });
  check(13, 'index: the code is smaller and quieter than the title',
    Boolean(styles) && styles.size < styles.hSize && Number(styles.weight) <= 500,
    styles ? `${styles.size}px ${styles.weight} ${styles.color} vs title ${styles.hSize}px` : 'no card');
  await p.close();
});

/* 13 · and the catalogue's own card (.ccard), rendered, signed out. */
await guarded(13, 'catalogue cards', async () => {
  const p = await page(out, 'courses.html');
  const order = await p.evaluate(cardOrder);
  check(13, 'courses (rendered): every course card leads with its name, not its code',
    order.length > 0 && order.every(o => o[0] === 'ccard-name' && o.indexOf('ccard-top') > 0),
    order[0]?.join('>') ?? 'no cards');
  const styles = await p.evaluate(() => {
    const c = document.querySelector('.ccode'), n = document.querySelector('.ccard-name');
    if (!c || !n) return null;
    const cs = getComputedStyle(c), ns = getComputedStyle(n);
    return { size: parseFloat(cs.fontSize), nSize: parseFloat(ns.fontSize),
             weight: Number(cs.fontWeight), nWeight: Number(ns.fontWeight) };
  });
  /* The brief asks for a code CHIP, so the old "weight <= 500" does not apply
     to it (it is a small pill); it must still be smaller and no bolder than the name. */
  check(13, 'courses: the code chip is smaller than, and no bolder than, the name',
    Boolean(styles) && styles.size < styles.nSize && styles.weight <= styles.nWeight,
    styles ? `${styles.size}px ${styles.weight} vs name ${styles.nSize}px ${styles.nWeight}` : 'no card');
  await p.close();
});

/* ── signed in ────────────────────────────────────────────── */
async function signIn(creds) {
  const ctx = await browser.newContext();
  const p = await page(ctx, 'login.html');
  await p.fill('#username', creds.username);
  await p.fill('#password', creds.password);
  await p.click('#loginSubmit');
  await p.waitForURL(/dashboard/, { timeout: 10_000 });
  await p.waitForTimeout(900);
  return { ctx, p };
}

const headerOf = p => p.evaluate(() => ({
  code: document.querySelector('.who-code')?.textContent.trim(),
  full: document.querySelector('.who-full')?.textContent.trim(),
  avatar: document.querySelector('.avatar')?.textContent.trim(),
  whoShown: document.querySelector('.who') ? !document.querySelector('.who').hasAttribute('hidden') : false,
  outShown: document.getElementById('signOut') ? !document.getElementById('signOut').hasAttribute('hidden') : false,
  inShown: document.getElementById('signIn') ? !document.getElementById('signIn').hasAttribute('hidden') : true,
  staffShown: [...document.querySelectorAll('[data-staff]')].filter(n => !n.hidden).length,
}));

let inn;
await guarded(2, 'learner sign in', async () => {
  const s = await signIn(LEARNER);
  inn = s.ctx;
  const header = await headerOf(s.p);
  /* The chip reads "<learner code> <full name>", avatar = first + last initial. */
  check(2, 'signed in: the real name is in the header',
    header.whoShown && header.outShown && !header.inShown
      && header.code === 'QT20P0007' && header.full === 'Lê Thị A' && header.avatar === 'LA',
    JSON.stringify(header));
  check(2, 'signed in: staff-only items stay hidden for a learner', header.staffShown === 0,
    `${header.staffShown} shown`);
  await s.p.close();
});
inn ??= await browser.newContext();   // later blocks fail on their own, not on this

/* 2 · and the staff-only nav appears once there is a staff session. This is
       the brief's replacement for the old "private nav items appear" (2 of 2):
       the Dashboard / My courses links that used to be hidden are now always
       shown, so there is nothing left of those to appear. */
await guarded(2, 'staff sign in', async () => {
  const s = await signIn(STAFF);
  const header = await headerOf(s.p);
  check(2, 'signed in as staff: the staff-only items appear', header.staffShown > 0 && header.code === 'Nhân viên',
    `${header.staffShown} shown, chip "${header.code}"`);
  await s.p.close();
  await s.ctx.close();
});

/* 4 · the course page, in all of its endings. */
await guarded(4, 'course page', async () => {
  const good = await page(inn, 'course.html?id=2489');
  await good.waitForTimeout(700);
  const g = await good.evaluate(() => ({
    h1: document.querySelector('.pagehead h1')?.textContent.trim() ?? '',
    crumb: document.querySelector('.crumb-now')?.textContent.trim() ?? '',
    title: document.title,
    trail: document.querySelector('.crumbs')?.textContent.trim() ?? '',
  }));
  check(4, 'course: heading becomes the course name', g.h1 && !/Đang tải|Loading/.test(g.h1), g.h1);
  check(4, 'course: <title> becomes the course name',
    g.h1 !== '' && g.title.includes(g.h1) && !/^Course \| GLOW$/.test(g.title), g.title);
  check(4, 'course: breadcrumb does not end in an empty segment',
    g.crumb.length > 0 && !/\/\s*$/.test(g.trail), JSON.stringify(g.trail));
  await good.close();

  /* A coded course, public: same three promises. */
  const coded = await page(inn, 'course.html?code=EL1001');
  await coded.waitForTimeout(700);
  const c = await coded.evaluate(() => ({
    h1: document.querySelector('.pagehead h1')?.textContent.trim() ?? '',
    crumb: document.querySelector('.crumb-now')?.textContent.trim() ?? '',
    title: document.title,
  }));
  check(4, 'course (code): heading, breadcrumb and <title> become the course name',
    c.h1 !== '' && !/Đang tải|Loading/.test(c.h1) && c.crumb !== '' && c.title.includes(c.h1), `${c.h1} | ${c.title}`);
  await coded.close();

  for (const [q, label] of [['id=999999', 'unknown id'], ['id=not-a-number', 'malformed id'], ['code=NOPE000', 'unknown code']]) {
    const bad = await page(inn, `course.html?${q}`);
    await bad.waitForTimeout(900);
    const b = await bad.evaluate(() => ({
      h1: document.querySelector('.pagehead h1')?.textContent.trim() ?? '',
      crumb: document.querySelector('.crumb-now')?.textContent.trim() ?? '',
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
});

/* 13 · the same demotion inside the app's own cards, signed in (the cards
       now carry a progress bar, and the name must still come first). */
await guarded(13, 'signed-in cards', async () => {
  const p = await page(inn, 'courses.html');
  await p.waitForTimeout(900);
  const order = await p.evaluate(cardOrder);
  check(13, 'courses (signed in): cards lead with the name, not the code',
    order.length > 0 && order.every(o => o[0] === 'ccard-name' && o.indexOf('ccard-top') > 0),
    order[0]?.join('>') ?? 'no cards');
  await p.close();
});

/* 14 · the Moodle front-page embed reads Moodle's own session. It counts as signed
       in only when body lacks "notloggedin" AND window.M.cfg.userId > 1 (0 is
       anonymous, 1 is Moodle's guest). No M at all fails safe: not signed in. */
const MOODLE_CASES = [
  { name: 'loggedin, userId 5',     cls: 'loggedin',    M: '{ cfg: { userId: 5 } }', inn: true },
  { name: 'loggedin, userId 1 (guest)', cls: 'loggedin', M: '{ cfg: { userId: 1 } }', inn: false },
  { name: 'loggedin, no M',         cls: 'loggedin',    M: null,                     inn: false },
  { name: 'notloggedin, userId 0',  cls: 'notloggedin', M: '{ cfg: { userId: 0 } }', inn: false },
];
for (const c of MOODLE_CASES) {
  await guarded(14, `moodle embed (${c.name})`, async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.route(`${BASE}/__moodle.html`, r => r.fulfill({ contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head></head><body id="page-site-index" class="${c.cls}">` +
            (c.M ? `<script>window.M = ${c.M};</script>` : '') +
            `<script src="${BASE}/embed/moodle.js"></script></body></html>` }));
    /* loadAuth ends with the /api/auth/me answer (401 here, as on Moodle), so
       wait for that, then one task so its continuation has run. */
    const me = p.waitForResponse(r => r.url().endsWith('/api/auth/me'));
    me.catch(() => {});   // a broken embed must fail this check, not crash the run
    await p.goto(`${BASE}/__moodle.html`);
    await p.waitForSelector('#glow-landing-page #signIn', { state: 'attached' });
    await me;
    await p.evaluate(() => new Promise(r => setTimeout(r, 0)));
    const seen = await p.evaluate(() => {
      const shown = sel => [...document.querySelectorAll(sel)].some(n => n.offsetParent !== null);
      return { dash: shown('[data-member]'), signIn: shown('#signIn'),
               staff: [...document.querySelectorAll('[data-staff]')].filter(n => !n.hidden).length };
    });
    check(14, `moodle embed, ${c.name}: Dashboard ${c.inn ? 'visible' : 'hidden'}, Sign in ${c.inn ? 'hidden' : 'visible'}, no staff links`,
      seen.dash === c.inn && seen.signIn === !c.inn && seen.staff === 0, JSON.stringify(seen));
    await ctx.close();
  });
}

/* 15 · Resources: EMMAI opens the advisor, three courses open their GLOW pages,
       English Library opens the platform course in a new tab. Static and runtime. */
const RES_CODES = ['EL5002', 'EL5007', 'EL5008'];
const RES_LIB = 'https://glow.mata9.com/course/view.php?id=4';
{
  const html = raw['resources.html'];
  const hasEmmai = /<button[^>]*class="chip"[^>]*data-emmai-open[^>]*>[\s\S]*?data-en="[^"]*EMMAI/.test(html);
  const codes = RES_CODES.map(c => html.includes(`href="./course.html?code=${c}"`));
  const lib = html.split('<a ').some(a => a.includes(`href="${RES_LIB}"`) && /target="_blank"/.test(a.split('>')[0]));
  check(15, 'resources.html (static): EMMAI chip, EL5002/EL5007/EL5008, English Library', hasEmmai && codes.every(Boolean) && lib,
    JSON.stringify({ hasEmmai, codes, lib }));
}
await guarded(15, 'resources (signed in)', async () => {
  const p = await page(inn, 'resources.html');
  await p.waitForSelector('.track .chip');
  const seen = await p.evaluate(({ codes, lib }) => {
    const emmai = [...document.querySelectorAll('button.chip[data-emmai-open]')]
      .some(b => [b, ...b.querySelectorAll('[data-en]')].some(n => /EMMAI/.test(n.dataset.en || n.textContent)));
    const a = [...document.querySelectorAll('a.chip')];
    return { emmai,
      codes: codes.map(c => a.some(x => x.getAttribute('href') === `./course.html?code=${c}`)),
      lib: a.some(x => x.getAttribute('href') === lib && x.target === '_blank') };
  }, { codes: RES_CODES, lib: RES_LIB });
  check(15, 'resources (signed in, runtime): EMMAI chip, EL5002/EL5007/EL5008, English Library',
    seen.emmai && seen.codes.every(Boolean) && seen.lib, JSON.stringify(seen));
  await p.close();
});

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
