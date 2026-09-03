/* WCAG AA contrast across the signed-in pages.

   The marketing page has tools/contrast.mjs; this is the same measurement
   for the pages that need a session first. It measures RENDERED colour —
   after inheritance, after alpha compositing, and at whatever opacity the
   reveal animations have left a node — because a token that passes on
   paper can still fail once it is 40% through a fade.

   Run the server, then: node tools/app-contrast.mjs [baseUrl] */

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8080';

const MEASURE = () => {
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
  const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));

  const bgOf = el => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > 0.9)) return c.slice(0, 3);
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const opOf = el => {
    let o = 1, n = el;
    while (n && n !== document.documentElement) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
    return o;
  };

  const out = [];
  document.querySelectorAll('p,h1,h2,h3,h4,a,span,li,b,strong,button,label,time,td,th').forEach(el => {
    if (!el.textContent.trim()) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 6) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    if (el.closest('[aria-hidden="true"]')) return;
    if (el.closest('.sr-only') || el.classList.contains('sr-only')) return;
    if (el.children.length && el.textContent.trim() !== (el.firstChild?.textContent || '').trim()) return;

    const a = opOf(el);
    if (a < 0.02) return;
    const fg = parse(cs.color).slice(0, 3);
    const bg = bgOf(el);
    const eff = over(fg, a, bg);
    const [x, y] = [lum(eff), lum(bg)].sort((m, n) => n - m);
    const ratio = (x + 0.05) / (y + 0.05);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      out.push({
        sel: (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : el.tagName),
        text: el.textContent.trim().slice(0, 34),
        ratio: +ratio.toFixed(2), need, size: Math.round(size), op: +a.toFixed(2),
      });
    }
  });
  return out;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const worst = new Map();

async function scan(label) {
  /* Past the reveal watchdog, so nothing is measured mid-fade. */
  await page.waitForTimeout(3200);
  for (const f of [0, 0.35, 0.7, 1]) {
    await page.evaluate(v => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.round(Math.max(0, max) * v));
    }, f);
    await page.waitForTimeout(500);
    for (const r of await page.evaluate(MEASURE)) {
      const k = `${label}|${r.sel}|${r.text}`;
      if (!worst.has(k) || worst.get(k).ratio > r.ratio) worst.set(k, { ...r, page: label });
    }
  }
}

await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle' });
await scan('login');

await page.fill('#username', 'demo');
await page.fill('#password', 'glow-demo-2026');
await page.click('#loginSubmit');
await page.waitForURL('**/dashboard.html');

for (const path of ['dashboard.html', 'courses.html', 'course.html?id=241', 'english.html', 'resources.html']) {
  await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle' });
  await scan(path);
}

/* And again in English — different string lengths wrap differently, and a
   language swap leaves nodes at animated opacities. */
await page.click('#langBtn');
await page.waitForTimeout(1500);
await scan('resources.html/en');

await browser.close();

const list = [...worst.values()].sort((a, b) => a.ratio - b.ratio);
if (!list.length) {
  console.log('\n  PASS — every visible text node meets WCAG AA on every signed-in page\n');
} else {
  console.log(`\n  ${list.length} failing text node(s):\n`);
  for (const r of list) {
    console.log(`   ${String(r.ratio).padStart(5)} (need ${r.need})  ${String(r.size).padStart(2)}px op=${r.op}  ` +
                `${r.page.padEnd(20)} ${r.sel}  "${r.text}"`);
  }
  console.log('');
}
process.exitCode = list.length ? 1 : 0;
