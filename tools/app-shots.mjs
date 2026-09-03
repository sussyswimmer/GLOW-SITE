/* Drives the real signed-in app in a browser: signs in, walks every page,
   captures a screenshot and reports any console error or dead link.
   Run the server first, then: node tools/app-shots.mjs [baseUrl]

   This is the check that the pages actually WORK, as opposed to the smoke
   test's check that the API does. They fail in different ways. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8080';
const OUT = 'qa/app';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`${page.url().split('/').pop()}: ${m.text()}`); });
page.on('pageerror', e => errors.push(`${page.url().split('/').pop()}: ${e.message}`));

/* ── sign in ─────────────────────────────────────────────── */
await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${OUT}/01-login.png` });

await page.fill('#username', 'demo');
await page.fill('#password', 'glow-demo-2026');
await page.click('#loginSubmit');
await page.waitForURL('**/dashboard.html', { timeout: 15_000 });

const report = [];

const PAGES = [
  ['dashboard.html', '02-dashboard'],
  ['courses.html', '03-courses'],
  /* Real GLOW course ids — see server/data/glow-catalogue.js. 241 has a
     demo interior, 2489 is an Upskilling course, and 1105 is a track this
     site has never been able to see inside, which is the case that must
     render as "material is in Moodle" rather than as an empty course. */
  ['course.html?id=241', '04-course-etop'],
  ['course.html?id=2489', '05-course-teamwork'],
  ['course.html?id=1105', '06-course-in-moodle'],
  ['english.html', '06-english'],
  ['resources.html', '07-resources'],
];

for (const [path, name] of PAGES) {
  await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle' });
  /* Wait for the view to have actually rendered rather than for the
     network to be quiet — a skeleton is also "quiet". */
  await page.waitForFunction(() => {
    const v = document.querySelector('#view');
    return v && v.children.length && !v.querySelector('.skel');
  }, { timeout: 15_000 }).catch(() => report.push(`${path}: #view never filled`));

  /* Long enough for the reveal watchdog in app.js (2.5s) to have run.
     The check below is the point: NOTHING may still be invisible once the
     page has settled, because invisible content is indistinguishable from
     missing content to the person looking at it. */
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('#view [data-rise]')]
      .filter(n => [...n.children].length &&
        [...n.children].every(k => Number(getComputedStyle(k).opacity) < 0.05))
      .map(n => n.textContent.trim().slice(0, 30)));
  if (hidden.length) report.push(`   ⚠ ${hidden.length} section(s) still invisible: ${hidden.join(' | ')}`);

  const stats = await page.evaluate(() => ({
    dead: [...document.querySelectorAll('a[href="#"], a[href=""]')].length,
    links: document.querySelectorAll('#view a[href]').length,
    unavailable: document.querySelectorAll('.is-unavailable').length,
    h1: document.querySelector('h1')?.textContent?.trim(),
    blankImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length,
    /* Every focusable control must be reachable and must show a ring. */
    focusables: document.querySelectorAll('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])').length,
  }));

  report.push(`${path.padEnd(24)} h1="${stats.h1}"  links=${stats.links}  dead=${stats.dead}  ` +
              `unavailable=${stats.unavailable}  brokenImg=${stats.blankImgs}  focusable=${stats.focusables}`);
  if (stats.dead) report.push(`   ⚠ ${stats.dead} link(s) still point at "#"`);
  if (stats.blankImgs) report.push(`   ⚠ ${stats.blankImgs} image(s) failed to load`);
}

/* ── the language toggle, on rendered content ───────────── */
await page.goto(`${BASE}/courses.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('#view .tile');
const beforeSwap = await page.textContent('.appnav a[data-page="courses.html"]');
await page.click('#langBtn');
await page.waitForTimeout(1200);
const afterSwap = await page.textContent('.appnav a[data-page="courses.html"]');
report.push(`language toggle: "${beforeSwap.trim()}" → "${afterSwap.trim()}"  ` +
            (beforeSwap.trim() !== afterSwap.trim() ? '✓' : '✗ did not swap'));
await page.screenshot({ path: `${OUT}/08-courses-en.png`, fullPage: true });

/* It must survive a navigation, which is the bug this was fixed for. */
await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const stuck = await page.getAttribute('html', 'lang');
report.push(`language persists across pages: lang="${stuck}" ${stuck === 'en' ? '✓' : '✗'}`);

/* ── mobile ──────────────────────────────────────────────── */
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(`${BASE}/login.html`, { waitUntil: 'networkidle' });
await phone.screenshot({ path: `${OUT}/09-login-390.png`, fullPage: true });
await phone.fill('#username', 'demo');
await phone.fill('#password', 'glow-demo-2026');
await phone.click('#loginSubmit');
await phone.waitForURL('**/dashboard.html');
await phone.waitForTimeout(1200);
await phone.screenshot({ path: `${OUT}/10-dashboard-390.png`, fullPage: true });

const overflow = await phone.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
report.push(`mobile 390px horizontal overflow: ${overflow}px ${overflow <= 0 ? '✓' : '✗'}`);

/* ── signed-out redirect ─────────────────────────────────── */
const anon = await browser.newPage();
await anon.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' });
await anon.waitForTimeout(1500);
report.push(`signed-out visit to dashboard → ${anon.url().split('/').pop()} ` +
            (anon.url().includes('login.html') ? '✓' : '✗ was not redirected'));

await browser.close();

console.log('\n' + report.join('\n'));
console.log(errors.length ? `\nconsole errors:\n  ${errors.join('\n  ')}` : '\nno console errors');
console.log(`\nscreenshots → ${OUT}/\n`);
