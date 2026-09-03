/* Visual + behavioural QA pass.
   node tools/qa.mjs [baseUrl]
   Shoots the page at scroll waypoints, collects console errors, and checks
   the thread never crosses body text at 1280 / 1440 / 1680. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5173/';
const OUT = 'qa';
mkdirSync(OUT, { recursive: true });

const WAYPOINTS = [
  ['00-hero',       0.00],
  ['01-pushin',     0.11],
  ['02-manifesto',  0.16],
  ['03-closeup',    0.22],
  ['04-chapters',   0.32],
  ['05-chapters2',  0.45],
  ['06-pullback',   0.58],
  ['07-gallery',    0.65],
  ['08-stats',      0.80],
  ['09-mission',    0.90],
  ['10-footer',     1.00],
];

const errors = [];

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
}

async function scrollTo(page, frac) {
  await page.evaluate(f => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(max * f));
  }, frac);
  await settle(page, 1100);
}

const browser = await chromium.launch();

/* ── 1. main pass at 1440 ─────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

  await page.goto(BASE, { waitUntil: 'load' });
  await settle(page, 3600);            // let the preloader finish

  for (const [name, frac] of WAYPOINTS) {
    await scrollTo(page, frac);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }

  // scroll back up — everything must be reversible
  await scrollTo(page, 0.30);
  await page.screenshot({ path: `${OUT}/08-reverse-chapters.png` });
  await scrollTo(page, 0.0);
  await page.screenshot({ path: `${OUT}/09-reverse-hero.png` });

  // language switch. The header is off screen at the top of the page now, so
  // the toggle has to be scrolled into reach before it can be clicked —
  // exactly what a visitor has to do.
  await page.evaluate(() => window.scrollTo(0, 320));
  await settle(page, 900);
  await page.click('#langBtn');
  await settle(page, 1600);
  await page.screenshot({ path: `${OUT}/10-lang-en.png` });
  const pressed = await page.getAttribute('#langBtn', 'aria-pressed');
  const heroText = await page.textContent('.hero-copy .lead');
  console.log(`lang: aria-pressed=${pressed}  lead="${heroText.slice(0, 42)}..."`);

  await ctx.close();
}

/* ── 2. layout sanity at the three named widths ───────── */
for (const w of [1280, 1440, 1680]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await settle(page, 3600);

  // walk the page so pinned sections lay out, then measure
  for (const f of [0.2, 0.4, 0.6, 0.8, 1.0]) await scrollTo(page, f);
  await scrollTo(page, 0);

  const hits = await page.evaluate(() => {
    const bad = [];
    const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (over > 1) bad.push(`h-overflow ${over}px`);
    document.querySelectorAll('.hero-copy, .mani-inner, .chap-body, .showcase-card, .mission-card, .quote')
      .forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 2) bad.push(`${el.className || el.tagName} past right edge`);
        if (r.left < -2) bad.push(`${el.className || el.tagName} past left edge`);
      });
    return bad;
  });

  console.log(`layout@${w}: ${hits.length ? hits.join(' | ') : 'clear'}`);
  await page.screenshot({ path: `${OUT}/layout-${w}.png` });
  await ctx.close();
}

/* ── 3. reduced motion ────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[reduced pageerror] ${e.message}`));
  await page.goto(BASE, { waitUntil: 'load' });
  await settle(page, 2500);
  await page.screenshot({ path: `${OUT}/rm-00-hero.png` });
  await scrollTo(page, 0.35);
  await page.screenshot({ path: `${OUT}/rm-01-chapters.png` });
  await scrollTo(page, 0.7);
  await page.screenshot({ path: `${OUT}/rm-02-gallery.png` });

  const readable = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.body, .lead, .mani-line, h2'));
    const hidden = els.filter(e => {
      const s = getComputedStyle(e);
      return parseFloat(s.opacity) < 0.5 || s.visibility === 'hidden' || s.display === 'none';
    });
    return { total: els.length, hidden: hidden.length };
  });
  console.log(`reduced-motion: ${readable.total} text blocks, ${readable.hidden} under-opacity`);
  await ctx.close();
}

/* ── 4. mobile ────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[mobile pageerror] ${e.message}`));
  await page.goto(BASE, { waitUntil: 'load' });
  await settle(page, 3200);
  await page.screenshot({ path: `${OUT}/mob-00-hero.png` });
  await scrollTo(page, 0.35);
  await page.screenshot({ path: `${OUT}/mob-01-chapters.png` });
  await scrollTo(page, 0.62);
  await page.screenshot({ path: `${OUT}/mob-02-gallery.png` });

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`mobile horizontal overflow: ${overflow}px`);
  await ctx.close();
}

await browser.close();

console.log('\n--- errors ---');
console.log(errors.length ? errors.slice(0, 25).join('\n') : 'none');
