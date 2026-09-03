/* Screenshot one section, plus report how its text is actually laid out. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('qa/peek', { recursive: true });

const base = process.argv[2];
const sel = process.argv[3] || '.manifesto';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(base, { waitUntil: 'load' });
await p.waitForTimeout(4200);

await p.evaluate(s => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
await p.waitForTimeout(1400);
await p.screenshot({ path: 'qa/peek/section.png' });

console.log(await p.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return 'not found';
  const line = el.querySelector('.mani-line') || el;
  const cs = getComputedStyle(line);
  const words = [...line.querySelectorAll('.w')];
  // group words by their vertical position to count real rendered lines
  const rows = new Map();
  words.forEach(w => {
    const t = Math.round(w.getBoundingClientRect().top);
    rows.set(t, (rows.get(t) || 0) + 1);
  });
  return {
    maxWidth: cs.maxWidth, fontSize: cs.fontSize, width: Math.round(line.getBoundingClientRect().width),
    words: words.length,
    renderedLines: rows.size,
    wordsPerLine: [...rows.values()],
    opacities: words.slice(0, 8).map(w => +getComputedStyle(w).opacity),
  };
}, sel));
await b.close();
