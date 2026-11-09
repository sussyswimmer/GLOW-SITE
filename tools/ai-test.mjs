/* ═══════════════════════════════════════════════════════════
   EMMAI and lesson-draft checks, against a local fake Messages API.
   No network, no real key:  npm run test:ai

   The no-key case needs a fresh config, so this file re-runs itself in a
   child process without ANTHROPIC_API_KEY (`--nokey`).
   ═══════════════════════════════════════════════════════════ */

import http from 'node:http';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NOKEY = process.argv.includes('--nokey');
let failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};

const DRAFT = {
  title: 'Sleep and Memory', titleVi: 'Giấc ngủ và trí nhớ',
  summary: 's', summaryVi: 'tt', body: 'One.\n\nTwo.', notes: 'check',
  keywords: Array.from({ length: 6 }, (_, i) => ({ word: `w${i}`, vi: `v${i}`, meaning: `m${i}` })),
};

/* ── the fake Messages API ─────────────────────────────── */
const seen = [];
let mode = 'ok';
const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', d => (raw += d));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    seen.push(body);
    if (mode === 'ratelimit') {
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' });
      return res.end(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }));
    }
    const draft = !!body.output_config?.format;
    const text = mode === 'badjson' && draft ? 'not json' : draft ? JSON.stringify(DRAFT) : 'Try [EL1001] first.';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_fake', type: 'message', role: 'assistant', model: body.model,
      content: [{ type: 'text', text }],
      stop_reason: mode === 'refusal' ? 'refusal' : 'end_turn', stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
  });
});
await new Promise(r => fake.listen(0, '127.0.0.1', r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
if (NOKEY) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-not-real';
process.env.DATA_SOURCE = 'mock';
process.env.LOGIN_MAX_ATTEMPTS = '100';

const { buildApp } = await import('../server/app.js');
const app = await buildApp({ serveStatic: false, logger: false });
await app.ready();

const login = async (username, password) => {
  const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });
  assert.equal(r.statusCode, 200, `login ${username}`);
  return `${r.cookies[0].name}=${r.cookies[0].value}`;
};
const post = (url, payload, cookie) =>
  app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} });

const learner = await login('demo', 'glow-demo-2026');
const staff = await login('demo-staff', 'glow-staff-2026');
const chat = { messages: [{ role: 'user', content: 'Which course for IELTS?' }], lang: 'en' };
const draftBody = { topic: 'Sleep', level: 'beginner', facts: 'Sleep helps the brain store what it learned during the day.' };
const systemText = b => b.system.map(s => s.text).join('\n');

if (NOKEY) {
  console.log('no key');
  await check('emmai 503 emmai_off', async () => {
    const r = await post('/api/emmai', chat, learner);
    assert.equal(r.statusCode, 503);
    assert.equal(r.json().error, 'emmai_off');
  });
  await check('draft 503 emmai_off for staff', async () => {
    const r = await post('/api/lessons/draft', draftBody, staff);
    assert.equal(r.statusCode, 503);
    assert.equal(r.json().error, 'emmai_off');
  });
  await check('draft still 403 for a learner without a key', async () => {
    assert.equal((await post('/api/lessons/draft', draftBody, learner)).statusCode, 403);
  });
} else {
  console.log('with fake key');
  await check('emmai 401 signed out', async () => {
    assert.equal((await post('/api/emmai', chat)).statusCode, 401);
  });
  await check('emmai 200 for a learner with the stub reply', async () => {
    const r = await post('/api/emmai', chat, learner);
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().reply, 'Try [EL1001] first.');
  });
  await check('request uses the right SDK parameters', async () => {
    const b = seen.at(-1);
    assert.equal(b.model, 'claude-opus-5-5');
    assert.equal(b.output_config.effort, 'low');
    assert.equal(b.fallbacks, 'default');
    assert.ok(b.system[0].cache_control, 'catalogue block is cache-marked');
  });
  await check('learner prompt has no PT codes, staff prompt does', async () => {
    seen.length = 0;
    await post('/api/emmai', chat, learner);
    await post('/api/emmai', chat, staff);
    const [l, s] = seen.map(systemText);
    assert.ok(!/\bPT\d{4}/.test(l), 'learner prompt leaked a PT code');
    assert.ok(/\bPT\d{4}/.test(s), 'staff prompt is missing PT codes');
    assert.ok(l.includes('EL1001'));
  });
  await check('role-gated: learner prompt has no GEMS course', async () => {
    seen.length = 0;
    await post('/api/emmai', chat, learner);
    assert.ok(!systemText(seen[0]).includes('EL5004'));
  });
  await check('400 on a bad body', async () => {
    assert.equal((await post('/api/emmai', { messages: [], lang: 'en' }, learner)).statusCode, 400);
    assert.equal((await post('/api/emmai', { ...chat, lang: 'fr' }, learner)).statusCode, 400);
    const long = { messages: [{ role: 'user', content: 'x'.repeat(1201) }], lang: 'en' };
    assert.equal((await post('/api/emmai', long, learner)).statusCode, 400);
    const endsAssistant = { messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }], lang: 'en' };
    assert.equal((await post('/api/emmai', endsAssistant, learner)).statusCode, 400);
  });
  await check('refusal gives a polite fixed 200 reply', async () => {
    mode = 'refusal';
    const r = await post('/api/emmai', { ...chat, lang: 'vi' }, learner);
    mode = 'ok';
    assert.equal(r.statusCode, 200);
    assert.match(r.json().reply, /không thể giúp/);
  });
  await check('upstream rate limit becomes 503 emmai_busy', async () => {
    mode = 'ratelimit';
    const r = await post('/api/emmai', chat, learner);
    mode = 'ok';
    assert.equal(r.statusCode, 503);
    assert.equal(r.json().error, 'emmai_busy');
  });
  await check('draft 401 signed out, 403 learner', async () => {
    assert.equal((await post('/api/lessons/draft', draftBody)).statusCode, 401);
    assert.equal((await post('/api/lessons/draft', draftBody, learner)).statusCode, 403);
  });
  await check('draft 200 for staff, structured output requested', async () => {
    seen.length = 0;
    const r = await post('/api/lessons/draft', draftBody, staff);
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().draft.keywords.length, 6);
    assert.equal(seen[0].output_config.format.type, 'json_schema');
  });
  await check('draft 400 on thin facts; 502 on unparseable output', async () => {
    assert.equal((await post('/api/lessons/draft', { ...draftBody, facts: 'short' }, staff)).statusCode, 400);
    mode = 'badjson';
    const r = await post('/api/lessons/draft', draftBody, staff);
    mode = 'ok';
    assert.equal(r.statusCode, 502);
  });
}

await app.close();
fake.close();

if (!NOKEY && !failed) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--nokey'], {
    stdio: 'inherit',
    env: { ...process.env, ANTHROPIC_API_KEY: '' },
  });
  failed += child.status ? 1 : 0;
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
