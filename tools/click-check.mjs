/* Verify the click ring actually fires and the press feedback engages. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'load' });
await p.waitForTimeout(4500);

console.log('rings in DOM:', await p.evaluate(() => document.querySelectorAll('.tap-ring').length));

const btn = await p.$('.btn-primary');
const box = await btn.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.waitForTimeout(180);

const mid = await p.evaluate(() => {
  const ring = Array.from(document.querySelectorAll('.tap-ring'))
    .map(r => ({ o: parseFloat(getComputedStyle(r).opacity), t: getComputedStyle(r).transform }))
    .filter(r => r.o > 0.01);
  const btn = document.querySelector('.btn-primary');
  return { activeRings: ring, btnTransform: getComputedStyle(btn).transform };
});
console.log('during press:', JSON.stringify(mid));

await p.mouse.up();
await p.waitForTimeout(900);
const after = await p.evaluate(() => ({
  activeRings: Array.from(document.querySelectorAll('.tap-ring')).filter(r => parseFloat(getComputedStyle(r).opacity) > 0.01).length,
  btnTransform: getComputedStyle(document.querySelector('.btn-primary')).transform,
}));
console.log('after release:', JSON.stringify(after));
await b.close();
