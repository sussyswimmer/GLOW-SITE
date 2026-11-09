/* End-to-end smoke test of the API and its security rules.
   Run the server, then: node tools/smoke.mjs [baseUrl]

   Every check here is one that would be embarrassing to find out about
   from a learner, so they run against the real process rather than mocks:
   auth is enforced, a bad password is refused, the session cookie is
   HttpOnly, a cross-origin POST is rejected, and the SSO bridge cannot be
   pointed off-site.

   It signs in four times (one per demo role) plus three refused attempts,
   and the login limiter allows ten per fifteen minutes per IP. Run it once
   per window against a fresh server, or start the server with
   LOGIN_MAX_ATTEMPTS=100 when iterating. */

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
for (const path of ['/api/dashboard', '/api/catalog/english', '/api/courses/101', '/api/billing']) {
  const r = await req(path);
  check(`${path} requires a session`, r.status === 401, `got ${r.status}`);
}
/* The old "My courses" list is gone: the dashboard and /api/catalogue replace it. */
check('/api/courses (the old list) no longer exists', (await req('/api/courses')).status === 404);

/* ── 2. health is open, and honest about demo mode ─────── */
const health = await (await req('/api/health')).json();
check('/api/health responds', health.ok === true);
check('/api/health declares its data source', typeof health.demo === 'boolean', `demo=${health.demo}`);

/* The tuition page is public, so its endpoint is open — and must therefore
   carry nothing about a learner: no status, no history. */
const pub = await req('/api/tuition');
const pubBody = await pub.json();
check('/api/tuition is open without a session', pub.status === 200, `got ${pub.status}`);
check('/api/tuition carries no learner data', !('status' in pubBody) && !('history' in pubBody),
  Object.keys(pubBody).join(','));
check('/api/tuition never prices GLOW at zero',
  pubBody.tuition?.amount === null || pubBody.tuition?.amount > 0, String(pubBody.tuition?.amount));

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

/* GLOW is a paid programme: the tuition is a positive amount or not yet
   announced (null) — never 0, which the page would show as a price of
   nothing. And the support links must be paths /api/sso will accept. */
const bill = await req('/api/billing');
const billBody = await bill.json();
check('billing loads with a session', bill.status === 200, `got ${bill.status}`);
check('billing status is a known state',
  ['unknown', 'unpaid', 'pending', 'paid', 'aid-review', 'aid-approved'].includes(billBody.status), billBody.status);
check('tuition is never zero',
  billBody.tuition?.amount === null || billBody.tuition?.amount > 0, String(billBody.tuition?.amount));
check('billing support links are site-relative',
  [billBody.contact?.payPath, billBody.contact?.aidPath].every(p => typeof p === 'string' && p.startsWith('/') && !p.startsWith('//')));

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

/* ── 6c. roles, and the catalogue they see ─────────────────
   The role comes from the server and decides which courses exist for a
   viewer. A course the viewer may not see is a 404, never a 403. */
const codesOf = body => new Set((body.courses || []).map(c => c.code));
const hasAny = (set, codes) => codes.filter(c => set.has(c));
const GATED = ['EL5004', 'EL5005', 'EL5006'];

async function loginAs(username, password) {
  jar = '';
  const r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  remember(r);
  return { status: r.status, body: await r.json() };
}

/* The dashboard v2 contract, for any role. */
function checkDashboard(who, d, { pinned, staff }) {
  check(`${who}: dashboard has recommended (≤3), pinned, emmai`,
    Array.isArray(d.recommended) && d.recommended.length > 0 && d.recommended.length <= 3 &&
    'pinned' in d && typeof d.emmai?.vi === 'string' && typeof d.emmai?.en === 'string');
  check(`${who}: pinned is ${pinned ? 'a titled block' : 'null'}`,
    pinned ? Boolean(d.pinned?.titleVi && d.pinned?.titleEn && d.pinned.courses.length) : d.pinned === null);
  const all = [...d.courses, ...d.recent, ...d.recommended, ...(d.pinned?.courses || [])];
  check(`${who}: every course has a code and a catalogue href`,
    all.every(c => c.code && /^\.\/course\.html\?code=[A-Za-z0-9]+$/.test(c.href)), all.find(c => !c.href)?.code);
  check(`${who}: recent has hours and lessons`,
    d.recent.length === 3 && d.recent.every(c => c.hours > 0 && c.lessonsTotal >= c.lessonsDone && c.lessonsDone >= 0));
  check(`${who}: events are upcoming and bilingual`,
    d.events.length > 0 && d.events.every(e => e.titleVi && Date.parse(e.when) > Date.now()));
  check(`${who}: courses are ${staff ? 'all staff training' : 'free of staff training'}`,
    d.courses.every(c => c.code.startsWith('PT') === staff));
}

const learnerJar = jar;

/* signed out */
jar = '';
const outCat = await (await req('/api/catalogue')).json();
const outCodes = codesOf(outCat);
check('catalogue (signed out): role is null, no gated or PT courses',
  outCat.role === null && hasAny(outCodes, GATED).length === 0 && ![...outCodes].some(c => c.startsWith('PT')),
  `${outCodes.size} courses`);
check('catalogue (signed out): no Training category and no progress',
  !outCat.categories.some(c => c.key === 'training') && outCat.courses.every(c => c.progress === null));
check('catalogue (signed out): carries the whole public catalogue',
  outCat.courses.length >= 45 && outCat.groups.length > 0 && outCat.subcategories.length > 0 && outCat.demo === true,
  `${outCat.courses.length} courses`);
check('catalogue course (signed out): a public one is 200', (await req('/api/catalogue/courses/EL1001')).status === 200);
check('catalogue course: lookup is case-insensitive', (await req('/api/catalogue/courses/el1001')).status === 200);
check('catalogue course (signed out): PT0001 is 404', (await req('/api/catalogue/courses/PT0001')).status === 404);
check('catalogue course (signed out): EL5004 is 404', (await req('/api/catalogue/courses/EL5004')).status === 404);
check('catalogue course: an unknown code is 404', (await req('/api/catalogue/courses/ZZ9999')).status === 404);
const ct = await (await req('/api/catalogue/courses/EM1001')).json();
check('catalogue course: names, presenter and no sections signed out',
  ct.course.vi === 'Cùng đọc Đắc Nhân tâm' && ct.course.presenter === 'Eric & Gil' && ct.sections.length === 0 && ct.role === null);
const moodleCourse = await (await req('/api/catalogue/courses/EL3001')).json();
check('catalogue course: a Moodle course exposes moodlePath', moodleCourse.course.moodlePath === '/course/view.php?id=241');

/* learner (the session from section 4) */
jar = learnerJar;
const me = await (await req('/api/auth/me')).json();
check('/api/auth/me (learner): role, idnumber and initials',
  me.learner.role === 'learner' && me.learner.idnumber === 'QT20P0007' && me.learner.initials === 'LA' && me.learner.fullname === 'Lê Thị A',
  JSON.stringify(me.learner));
checkDashboard('learner', dashBody, { pinned: false, staff: false });
const lCat = await (await req('/api/catalogue')).json();
check('catalogue (learner): no gated or PT courses, progress attached',
  lCat.role === 'learner' && hasAny(codesOf(lCat), GATED).length === 0 && ![...codesOf(lCat)].some(c => c.startsWith('PT')) &&
  lCat.courses.find(c => c.code === 'EL3001')?.progress === 60 && lCat.courses.find(c => c.code === 'EL1002')?.progress === null);
check('catalogue course (learner): PT0001 is 404', (await req('/api/catalogue/courses/PT0001')).status === 404);
const lEtop = await (await req('/api/catalogue/courses/EL3001')).json();
check('catalogue course (learner): an enrolled Moodle course carries sections and progress',
  lEtop.sections.length > 0 && lEtop.course.progress === 60 && lEtop.course.enrolled === true);

/* gems */
const gems = await loginAs('demo-gems', 'glow-demo-2026');
check('gems signs in', gems.status === 200, `got ${gems.status}`);
const gMe = await (await req('/api/auth/me')).json();
check('/api/auth/me (gems): role, idnumber and initials',
  gMe.learner.role === 'gems' && gMe.learner.idnumber === 'HU21G0012' && gMe.learner.initials === 'NB', JSON.stringify(gMe.learner));
const gCodes = codesOf(await (await req('/api/catalogue')).json());
check('catalogue (gems): sees EL5004 and EL5005, not EL5006, not PT',
  gCodes.has('EL5004') && gCodes.has('EL5005') && !gCodes.has('EL5006') && ![...gCodes].some(c => c.startsWith('PT')));
check('catalogue course (gems): EL5004 is 200, PT0001 is 404',
  (await req('/api/catalogue/courses/EL5004')).status === 200 && (await req('/api/catalogue/courses/PT0001')).status === 404);
checkDashboard('gems', await (await req('/api/dashboard')).json(), { pinned: true, staff: false });

/* seeds */
const seeds = await loginAs('demo-seeds', 'glow-demo-2026');
check('seeds signs in', seeds.status === 200, `got ${seeds.status}`);
const sMe = await (await req('/api/auth/me')).json();
check('/api/auth/me (seeds): role, idnumber and initials',
  sMe.learner.role === 'seeds' && sMe.learner.idnumber === 'QT24S0031' && sMe.learner.initials === 'TC', JSON.stringify(sMe.learner));
const sCodes = codesOf(await (await req('/api/catalogue')).json());
check('catalogue (seeds): sees EL5006, not EL5004 or EL5005, not PT',
  sCodes.has('EL5006') && !sCodes.has('EL5004') && !sCodes.has('EL5005') && ![...sCodes].some(c => c.startsWith('PT')));
checkDashboard('seeds', await (await req('/api/dashboard')).json(), { pinned: true, staff: false });

/* staff */
const staff = await loginAs('demo-staff', 'glow-staff-2026');
check('staff signs in', staff.status === 200, `got ${staff.status}`);
const stMe = await (await req('/api/auth/me')).json();
check('/api/auth/me (staff): role, no idnumber, initials',
  stMe.learner.role === 'staff' && !stMe.learner.idnumber && stMe.learner.initials === 'PD', JSON.stringify(stMe.learner));
const stCat = await (await req('/api/catalogue')).json();
const stCodes = codesOf(stCat);
check('catalogue (staff): sees PT, the gems and seeds courses, and Training',
  stCodes.has('PT0001') && stCodes.has('PT4004') && GATED.every(c => stCodes.has(c)) && stCat.categories.some(c => c.key === 'training'));
check('catalogue course (staff): PT0001 is 200', (await req('/api/catalogue/courses/PT0001')).status === 200);
checkDashboard('staff', await (await req('/api/dashboard')).json(), { pinned: true, staff: true });
check('the staff demo password does not sign in the learner account',
  (await loginAs('demo', 'glow-staff-2026')).status === 401);

jar = learnerJar;

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
