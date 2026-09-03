import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('console', m => console.log(`[${m.type()}] ${m.text()}`));
p.on('pageerror', e => console.log(`[PAGEERROR] ${e.message}\n${e.stack?.split('\n').slice(0, 6).join('\n')}`));
p.on('requestfailed', r => console.log(`[404?] ${r.url()} :: ${r.failure()?.errorText}`));
await p.goto(process.argv[2] || 'http://localhost:5173/', { waitUntil: 'load' });
await p.waitForTimeout(5000);
console.log('--- state ---');
console.log(await p.evaluate(() => ({
  preGone: document.getElementById('preloader')?.classList.contains('gone'),
  counter: document.getElementById('preNum')?.textContent,
  curtainDone: document.querySelector('.curtain')?.classList.contains('done'),
  frames: document.querySelectorAll('#thread path').length,
  threadD: (document.getElementById('threadPath')?.getAttribute('d') || '').slice(0, 60),
  docH: document.documentElement.scrollHeight,
})));
await b.close();
