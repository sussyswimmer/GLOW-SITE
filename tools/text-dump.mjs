/* Dump every visible string on every page, in both languages, so the copy can
   actually be read end to end instead of trusted. */
import { chromium } from 'playwright';

const BASE = process.argv[2];
const PAGES = ['index', 'dashboard', 'courses', 'course', 'english', 'resources'];

const b = await chromium.launch();
for (const page of PAGES) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(BASE + page + '.html', { waitUntil: 'load' });
  await p.waitForTimeout(page === 'index' ? 4000 : 1200);

  const dump = await p.evaluate(() => {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,span,footer,blockquote').forEach(el => {
      if (el.closest('[aria-hidden="true"]')) return;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt || txt.length < 2 || seen.has(txt)) return;
      // leaf-ish only
      if (el.children.length && txt !== (el.firstChild?.textContent || '').replace(/\s+/g,' ').trim()) return;
      seen.add(txt);
      const vi = el.getAttribute('data-vi'), en = el.getAttribute('data-en');
      out.push(vi || en ? `${txt}   ⇄ EN: ${en}` : txt);
    });
    return out;
  });

  console.log(`\n════════ ${page.toUpperCase()} ════════`);
  dump.forEach(l => console.log('  ' + l));
  await p.context().close();
}
await b.close();
