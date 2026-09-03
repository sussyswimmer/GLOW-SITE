/* Screenshot every page and report console errors. Works against dev or dist. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('qa/pages', { recursive: true });

const BASE = process.argv[2] || 'http://localhost:5173/';
const PAGES = ['index', 'dashboard', 'courses', 'course', 'english', 'resources'];

const b = await chromium.launch();
const errs = [];
for (const page of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${page}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${page}: ${m.text()}`); });
  await p.goto(BASE + page + '.html', { waitUntil: 'load' });
  await p.waitForTimeout(page === 'index' ? 4200 : 1800);
  await p.screenshot({ path: `qa/pages/${page}.png` });

  // and the scrolled state, so long pages get checked too
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
  await p.waitForTimeout(900);
  await p.screenshot({ path: `qa/pages/${page}-mid.png` });

  const overflow = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${page.padEnd(10)} overflow=${overflow}px`);
  await ctx.close();
}
console.log('\n--- errors ---');
console.log(errs.length ? [...new Set(errs)].join('\n') : 'none');
await b.close();
