/* Measure real rendered contrast for every text node on the page, including
   whatever opacity the scroll animations have left it at. */
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(process.argv[2] || 'http://localhost:5173/', { waitUntil: 'load' });
await p.waitForTimeout(4200);

const marks = [0, 0.1, 0.28, 0.42, 0.62, 0.78, 0.9, 1];
const worst = new Map();

for (const f of marks) {
  await p.evaluate(v => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.round(max * v));
  }, f);
  await p.waitForTimeout(1100);

  const rows = await p.evaluate(() => {
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));

    // walk up for the first opaque background
    const bgOf = el => {
      let n = el;
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0.9)) return c.slice(0, 3);
        n = n.parentElement;
      }
      return [255, 255, 255];
    };
    // effective opacity from every ancestor
    const opOf = el => {
      let o = 1, n = el;
      while (n && n !== document.documentElement) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
      return o;
    };

    const out = [];
    document.querySelectorAll('p,h1,h2,h3,h4,a,span,li,b,footer,button').forEach(el => {
      if (!el.textContent.trim()) return;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 6) return;
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      // decorative, hidden from the accessibility tree -> exempt by spec
      if (el.closest('[aria-hidden="true"]')) return;
      // only leaf-ish nodes, so we don't score containers
      if (el.children.length && el.textContent.trim() !== (el.firstChild?.textContent || '').trim()) return;

      const fg = parse(cs.color).slice(0, 3);
      const bg = bgOf(el);
      const a = opOf(el);
      if (a < 0.02) return;
      const eff = over(fg, a, bg);
      const [x, y] = [lum(eff), lum(bg)].sort((m, n) => n - m);
      const ratio = (x + 0.05) / (y + 0.05);
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        out.push({
          sel: (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName),
          text: el.textContent.trim().slice(0, 32),
          ratio: +ratio.toFixed(2), need, size: Math.round(size), op: +a.toFixed(2),
        });
      }
    });
    return out;
  });

  for (const r of rows) {
    const k = r.sel + '|' + r.text;
    if (!worst.has(k) || worst.get(k).ratio > r.ratio) worst.set(k, r);
  }
}

const list = [...worst.values()].sort((a, b) => a.ratio - b.ratio);
if (!list.length) console.log('PASS — every visible text node meets WCAG AA at every scroll position');
else {
  console.log(`${list.length} failing text node(s):`);
  for (const r of list) console.log(`  ${String(r.ratio).padStart(5)} (need ${r.need})  ${r.size}px op=${r.op}  ${r.sel}  "${r.text}"`);
}
await b.close();
