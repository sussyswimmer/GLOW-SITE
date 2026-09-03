/* Find the union alpha bounding box across the keyed sequence. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:5173/', { waitUntil: 'load' });

const res = await p.evaluate(async () => {
  const names = [1, 16, 31, 46, 61, 76, 91, 106].map(n => `./assets/seq/lantern/frame_${String(n).padStart(4, '0')}.webp`);
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, W = 0, H = 0;
  for (const src of names) {
    const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
    if (!img) continue;
    W = img.naturalWidth; H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    for (let yy = 0; yy < H; yy++) {
      for (let xx = 0; xx < W; xx++) {
        if (d[(yy * W + xx) * 4 + 3] > 12) {
          if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
          if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
        }
      }
    }
  }
  return { W, H, minX, maxX, minY, maxY };
});
console.log(res);
console.log(`content: ${res.maxX - res.minX + 1} x ${res.maxY - res.minY + 1}`);
console.log(`fraction: w=${((res.maxX - res.minX + 1) / res.W).toFixed(3)} h=${((res.maxY - res.minY + 1) / res.H).toFixed(3)}`);
await b.close();
