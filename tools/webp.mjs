/* ═══════════════════════════════════════════════════════════
   PNG -> WebP at delivery size, using the Chromium that Playwright
   already installs for the QA scripts.

   Why not sharp: it would be a native dependency added to a project
   whose only build step is Vite, for a job that runs a handful of times.
   Chromium's canvas encoder is already on this machine and is good
   enough for flat gradient artwork, which is what these are.

   node tools/webp.mjs <in.png> <out.webp> <maxW> [quality]
   ═══════════════════════════════════════════════════════════ */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const [, , input, output, maxWArg, qArg] = process.argv;
if (!input || !output || !maxWArg) {
  console.error('usage: node tools/webp.mjs <in.png> <out.webp> <maxW> [quality 0-1]');
  process.exit(1);
}
const maxW = Number(maxWArg);
const quality = Number(qArg ?? 0.82);

const b64 = readFileSync(input).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();

const dataUrl = await page.evaluate(async ({ b64, maxW, quality }) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();

  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/webp', quality);
}, { b64, maxW, quality });

await browser.close();

if (!dataUrl.startsWith('data:image/webp')) {
  console.error('Chromium did not produce WebP — got', dataUrl.slice(0, 30));
  process.exit(1);
}

writeFileSync(output, Buffer.from(dataUrl.split(',')[1], 'base64'));

const before = statSync(input).size, after = statSync(output).size;
console.log(`${output}  ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024).toFixed(0)}KB` +
            `  (${Math.round((1 - after / before) * 100)}% smaller)`);
