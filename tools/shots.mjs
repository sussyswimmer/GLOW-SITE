/* Quick visual sweep of the whole page. node tools/shots.mjs [baseUrl] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('qa/v3', { recursive: true });

const BASE = process.argv[2] || 'http://localhost:5173/';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto(BASE, { waitUntil: 'load' });
await p.waitForTimeout(4500);

const marks = [
  ['00-hero', 0], ['01-manifesto', 0.10], ['02-exit', 0.17],
  ['03-showcase', 0.28], ['04-chapters', 0.42], ['05-gallery', 0.62],
  ['06-stats', 0.78], ['07-mission', 0.90], ['08-footer', 1.0],
];
for (const [name, f] of marks) {
  await p.evaluate(v => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(max * v));
  }, f);
  await p.waitForTimeout(1300);
  await p.screenshot({ path: `qa/v3/${name}.png` });
}
console.log('shots done');
await b.close();
