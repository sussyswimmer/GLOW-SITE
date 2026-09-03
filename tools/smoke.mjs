/* End-to-end smoke test of the API and its security rules.
   Run the server, then: node tools/smoke.mjs [baseUrl]

   Every check here is one that would be embarrassing to find out about
   from a learner, so they run against the real process rather than mocks:
   auth is enforced, a bad password is refused, the session cookie is
   HttpOnly, a cross-origin POST is rejected, and the SSO bridge cannot be
   pointed off-site. */

const BASE = process.argv[2] || 'http://localhost:8080';

let pass = 0, fail = 0;
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  ok ? pass++ : fail++;
}

/* A tiny cookie jar — enough to carry one session across requests. */
let jar = '';
function remember(res) {
  const set = res.headers.getSetCookie?.() || [];
  for (const c of set) {
    const [pair] = c.split(';');
    if (pair.startsWith('glow_session=')) jar = pair;
  }
  return set;
}

async function req(path, opts = {}) {
  return fetch(BASE + path, {
    ...opts,
    headers: {
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
      ...(jar ? { cookie: jar } : {}),
      /* Every state change must state an Origin and it must be ours. In
         development the server lets a caller with no Origin through — it
         cannot be CSRF'd, having no ambient cookie — so this used to pass
         without one. Against a PRODUCTION deployment the same requests come
         back 403 origin_required, and the suite could not test the thing it
         was written to protect. Declared before opts.headers so the
         cross-origin test below can still override it with evil.example. */
      origin: BASE,
      ...opts.headers,
    },
    redirect: 'manual',
  });
}

/* ── 1. the API is closed by default ───────────────────── */
for (const path of ['/api/dashboard', '/api/courses', '/api/catalog/english', '/api/courses/101']) {
  const r = await req(path);
  check(`${path} requires a session`, r.status === 401, `got ${r.status}`);
}

/* ── 2. health is open, and honest about demo mode ─────── */
const health = await (await req('/api/health')).json();
check('/api/health responds', health.ok === true);
check('/api/health declares its data source', typeof health.demo === 'boolean', `demo=${health.demo}`);

/* ── 3. a wrong password is refused, without saying why ── */
const bad = await req('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'demo', password: 'not-the-password' }),
});
const badBody = await bad.json();
check('wrong password is rejected', bad.status === 401, `got ${bad.status}`);

/* User enumeration: the real test is not what the message says but that
   it says exactly the same thing either way. A nonexistent account and a
   real account with the wrong password must be indistinguishable, or the
   login form becomes a way to check who has a GLOW account. */
const nobody = await req('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'no-such-person-9d3f', password: 'not-the-password' }),
});
const nobodyBody = await nobody.json();
check('an unknown user and a wrong password are indistinguishable',
  nobody.status === bad.status &&
  nobodyBody.error === badBody.error &&
  nobodyBody.message === badBody.message,
  `${nobody.status}/${nobodyBody.message} vs ${bad.status}/${badBody.message}`);

/* ── 4. a good password signs in ───────────────────────── */
const good = await req('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'demo', password: 'glow-demo-2026' }),
});
const cookies = remember(good);
check('correct password signs in', good.status === 200, `got ${good.status}`);
check('a session cookie is issued', Boolean(jar));

const cookieLine = cookies.find(c => c.startsWith('glow_session=')) || '';
check('session cookie is HttpOnly', /httponly/i.test(cookieLine), cookieLine.slice(0, 60));
check('session cookie is SameSite', /samesite/i.test(cookieLine));
check('session cookie does not leak the token in plain text',
  !/mock-token|wstoken/i.test(cookieLine));

/* ── 5. the session opens the API ──────────────────────── */
const dash = await req('/api/dashboard');
const dashBody = await dash.json();
check('dashboard loads with a session', dash.status === 200, `got ${dash.status}`);
check('dashboard carries the learner', Boolean(dashBody.learner?.fullname));
check('dashboard carries courses', Array.isArray(dashBody.courses) && dashBody.courses.length > 0,
  `${dashBody.courses?.length} courses`);
check('demo data is flagged as demo', dashBody.demo === true);

/* ── 6. the contract holds ─────────────────────────────── */
/* Take the id from the dashboard rather than naming one. Course ids are
   the platform's, so hard-coding one here means this test breaks the next
   time the catalogue is re-crawled — and breaks in a way that looks like
   a contract failure rather than a stale fixture. */
const firstCourseId = dashBody.courses[0].id;
const course = await (await req(`/api/courses/${firstCourseId}`)).json();
check('a course loads its sections', Array.isArray(course.sections) && course.sections.length > 0,
  `course ${firstCourseId}`);

const activities = (course.sections || []).flatMap(s => s.activities);
check('no activity links to nowhere',
  activities.every(a => a.href !== '#' && a.href !== ''),
  `${activities.length} activities checked`);
check('every activity declares a type', activities.every(a => a.type && a.typeLabel));

const progress = (dashBody.courses || []).every(c =>
  typeof c.progress === 'number' && c.progress >= 0 && c.progress <= 100);
check('progress is a real 0–100 number', progress);

/* ── 6b. every catalogue chip opens something ───────────
   The English and Resources pages link each track by its real GLOW
   course id. A chip whose id resolves to a 404 is the same failure the
   87 dead "#" links were, just wearing a number — so check the whole
   catalogue, not a sample. */
for (const key of ['english', 'resources']) {
  const cat = await (await req(`/api/catalog/${key}`)).json();
  const ids = (cat.groups || []).flatMap(g => g.items).map(i => i.courseId).filter(Boolean);
  const statuses = await Promise.all(ids.map(async id => [id, (await req(`/api/courses/${id}`)).status]));
  const dead = statuses.filter(([, s]) => s !== 200);
  check(`every /${key} chip opens a course`, ids.length > 0 && dead.length === 0,
    dead.length ? `dead: ${dead.map(([id, s]) => `${id}→${s}`).join(', ')}` : `${ids.length} chips`);
}

/* ── 7. a course you are not in is refused ─────────────── */
const missing = await req('/api/courses/999999');
check('an unknown course is 404, not a blank page', missing.status === 404, `got ${missing.status}`);

/* ── 8. CSRF: a cross-origin state change is rejected ──── */
const cross = await req('/api/auth/login', {
  method: 'POST',
  headers: { origin: 'https://evil.example' },
  body: JSON.stringify({ username: 'demo', password: 'glow-demo-2026' }),
});
check('cross-origin POST is rejected', cross.status === 403, `got ${cross.status}`);

/* ── 9. the SSO bridge cannot be turned into an open redirect ── */
for (const target of ['https://evil.example', '//evil.example', '/\\evil.example', '/path\r\nX: y']) {
  const r = await req(`/api/sso?to=${encodeURIComponent(target)}`);
  const location = r.headers.get('location') || '';
  const escaped = /evil\.example/.test(location);
  check(`sso refuses "${target.slice(0, 24)}"`, r.status === 400 || !escaped,
    `${r.status} → ${location.slice(0, 40)}`);
}

/* ── 10. signing out actually ends it ──────────────────── */
const out = await req('/api/auth/logout', { method: 'POST' });
const cleared = (out.headers.getSetCookie?.() || []).find(c => c.startsWith('glow_session='));
check('logout clears the cookie', Boolean(cleared) && /max-age=0|expires=/i.test(cleared));

jar = 'glow_session=';   // what the browser will now send
const after = await req('/api/dashboard');
check('the API is closed again after logout', after.status === 401, `got ${after.status}`);

/* ── 11. a tampered cookie is not accepted ─────────────── */
jar = 'glow_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const tampered = await req('/api/dashboard');
check('a forged cookie is rejected', tampered.status === 401, `got ${tampered.status}`);

/* ── 12. brute-force lockout, opt-in ───────────────────────
   SMOKE_RATE_LIMIT=1 npm test

   Off by default on purpose: proving the limiter works means spending
   the whole ten-attempt budget, and the window is fifteen minutes — so
   running it every time would make the suite fail for a quarter of an
   hour after each pass, which trains people to ignore it.

   What it guards: the lockout answering 429 and not 500. That distinction
   is invisible until it reaches a learner, who is told "something went
   wrong on our end" for a wait-and-retry condition and has no idea to
   just wait. */
if (process.env.SMOKE_RATE_LIMIT === '1') {
  /* One more than LOGIN_MAX_ATTEMPTS's default, so the limiter is reached
     even if a couple of the attempts above already counted against it. */
  let locked = null;
  for (let i = 0; i < 15 && locked === null; i++) {
    const r = await req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'nobody', password: 'nobody' }),
    });
    if (r.status !== 401) locked = r.status;
  }
  check('brute force is locked out with 429, not 500', locked === 429, `got ${locked}`);
}

/* ── report ────────────────────────────────────────────── */
console.log('');
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail && !r.ok ? `  — ${r.detail}` : ''}`);
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
/* exitCode rather than process.exit(): keep-alive sockets from the fetches
   above are still open, and tearing the loop down under them trips a libuv
   assertion on Windows. Setting the code lets Node exit once they close. */
process.exitCode = fail ? 1 : 0;
