/* ═══════════════════════════════════════════════════════════
   The live adapter — Moodle web services → the contract.

   Moodle's REST API has three habits that all have to be handled
   here rather than anywhere else:

   1. It answers errors with HTTP 200. A failed call is a normal-looking
      response whose body happens to contain `exception`. Anything that
      only checks res.ok will treat a permissions failure as data.
   2. It returns HTML in fields documented as text. Course summaries come
      back as "<p>…</p>&nbsp;" and go straight into the page unless they
      are stripped here.
   3. Its field names are inconsistent across functions — id/courseid,
      fullname/name, progress that is null rather than 0.

   All three are absorbed at this boundary so nothing downstream knows
   Moodle exists.
   ═══════════════════════════════════════════════════════════ */

import { config } from '../config.js';
import { assertDashboard, assertCourseDetail, ContractError } from './contract.js';

const REST = () => `${config.MOODLE_URL}/webservice/rest/server.php`;

/* Moodle can be slow on a cold cache, but a learner staring at a spinner
   is worse than an honest error, and an un-timed-out fetch will pin a
   request handler open indefinitely if the upstream hangs. */
const TIMEOUT_MS = 12_000;

/**
 * One web-services call.
 *
 * @param {string} token    the LEARNER'S own token, never a site-wide one —
 *                          so Moodle's own capability checks still apply and
 *                          a bug here cannot read another learner's data.
 */
async function call(token, wsfunction, params = {}) {
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: 'json',
    ...flatten(params),
  });

  let res;
  try {
    res = await fetch(REST(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const why = err?.name === 'TimeoutError' ? `did not respond within ${TIMEOUT_MS / 1000}s` : err.message;
    throw new UpstreamError(`Moodle ${why}`, 504);
  }

  if (!res.ok) throw new UpstreamError(`Moodle returned HTTP ${res.status} for ${wsfunction}`, 502);

  let json;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError(`Moodle returned a non-JSON body for ${wsfunction}`, 502);
  }

  /* Habit #1. This is the check that matters most in the whole file. */
  if (json && typeof json === 'object' && json.exception) {
    /* An expired or revoked token is not a server fault — it means the
       learner needs to sign in again, and the route layer turns 401 into
       exactly that. Everything else is genuinely upstream's problem. */
    const expired = json.errorcode === 'invalidtoken' || json.errorcode === 'accessexception';
    throw new UpstreamError(
      `Moodle refused ${wsfunction}: ${json.errorcode || 'unknown'}`,
      expired ? 401 : 502,
    );
  }

  return json;
}

/* Moodle takes arrays as courseids[0], courseids[1], … rather than JSON. */
function flatten(params, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(params)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => flatten({ [i]: item }, key, out));
    else if (v && typeof v === 'object') flatten(v, key, out);
    else if (v !== undefined && v !== null) out[key] = String(v);
  }
  return out;
}

class UpstreamError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'UpstreamError';
    this.statusCode = statusCode;
  }
}

/* ── habit #2: get the markup out ────────────────────────────
   Course summaries are authored in Moodle's rich-text editor, so they
   arrive as HTML. We want one clean line for a tile, which means
   stripping tags AND decoding the entities underneath — stripping alone
   leaves "&nbsp;" and "&amp;" visible in the UI. */
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#039;': "'", '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

export function plain(html, max = 200) {
  if (!html) return '';
  const text = String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&[a-z]+;|&#0?39;/gi, m => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function initialsOf(fullname) {
  const parts = String(fullname || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  /* Vietnamese names are family-name-first and often three or four parts,
     where the LAST part is the given name people are actually called by.
     Taking the first two initials the Western way gives you the family and
     middle name, which is not how anyone here would be addressed — so we
     take the first and the last. */
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── habit #3, and the file-URL problem ──────────────────────
   Moodle serves course images from pluginfile.php, which requires the
   web-services token as a query parameter. Handing that URL to the
   browser would put a live credential in an <img src> — visible in
   devtools, in the referrer, and in any proxy log along the way.

   So we never do. Course images are rewritten to a path on THIS server,
   which fetches them with the token server-side. See routes/media.js. */
function proxied(fileurl) {
  if (!fileurl) return undefined;
  return `/api/media?src=${encodeURIComponent(fileurl)}`;
}

/* Activities that live in Moodle — quizzes, assignments, the ETOP
   scheduler, forums — are routed through our SSO bridge rather than
   linked directly, so the learner arrives already signed in instead of
   at a login form. That handoff is the entire reason a quiz can stay in
   Moodle while the rest of the experience lives here.

   Anything pointing off-site (a TED talk, Khan Academy) is left alone. */
function ssoLink(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.origin !== new URL(config.MOODLE_URL).origin) return rawUrl;
    return `/api/sso?to=${encodeURIComponent(u.pathname + u.search)}`;
  } catch {
    return rawUrl;
  }
}

/* Moodle's module names → the small set the UI knows how to draw. */
const MOD_TYPES = {
  url: 'url', resource: 'file', folder: 'folder', page: 'page',
  quiz: 'quiz', assign: 'assign', forum: 'forum', scheduler: 'scheduler',
  book: 'page', lesson: 'page', choice: 'other', feedback: 'other',
  questionnaire: 'other', label: 'label', h5pactivity: 'other', lti: 'other',
};
const MOD_LABELS = {
  url: 'Link', file: 'File', folder: 'Folder', page: 'Page', quiz: 'Quiz',
  assign: 'Assignment', forum: 'Forum', scheduler: 'Scheduler', other: 'Activity',
};

function normaliseCourse(c) {
  /* progress is null on any course without completion tracking switched on.
     Coercing that to 0 would tell every learner they had done nothing; the
     `tracked` flag lets the UI omit the bar instead of lying with it. */
  const tracked = typeof c.progress === 'number' && c.enablecompletion !== 0;
  return {
    id: c.id,
    code: c.shortname || '',
    title: plain(c.displayname || c.fullname),
    summary: plain(c.summary, 160),
    image: proxied(c.overviewfiles?.[0]?.fileurl) || proxied(c.courseimage),
    progress: tracked ? Math.max(0, Math.min(100, Math.round(c.progress))) : 0,
    tracked,
    category: plain(c.categoryname || ''),
    /* Where this course lives on the platform. The UI hands it to
       /api/sso, which is what makes "Open in Moodle" land the learner
       already signed in rather than at a login form. Site-relative on
       purpose — /api/sso rejects anything absolute. */
    moodlePath: `/course/view.php?id=${c.id}`,
    enrolled: true,
    lastAccess: c.lastaccess ? new Date(c.lastaccess * 1000).toISOString() : undefined,
  };
}

function normaliseModule(m) {
  if (m.modname === 'label') return null;        // labels are decoration, not rows
  if (m.uservisible === false) return null;      // respect Moodle's own access rules

  const type = MOD_TYPES[m.modname] || 'other';

  /* The href rule from the contract: a real destination or none at all.
     Moodle omits `url` for modules with no page of their own, and the
     honest rendering of that is a disabled row, not a link to "#". */
  let href = m.url ? ssoLink(m.url) : undefined;
  if (type === 'file' && m.contents?.[0]?.fileurl) href = proxied(m.contents[0].fileurl);

  const state = m.completiondata?.state;
  const completion = m.completiondata?.isautomatic === undefined && state === undefined
    ? 'none'
    : (state === 1 || state === 2) ? 'done' : 'todo';

  return {
    id: m.id,
    title: plain(m.name),
    type,
    typeLabel: MOD_LABELS[type] || 'Activity',
    href,
    external: Boolean(href && !href.startsWith('/api/')),
    completion,
    due: m.dates?.find(d => d.dataid === 'duedate')?.timestamp
      ? new Date(m.dates.find(d => d.dataid === 'duedate').timestamp * 1000).toISOString()
      : undefined,
  };
}

/* ── the adapter surface ─────────────────────────────────────
   These four functions are the entire contract with the route layer.
   mock.js implements the same four. */

export async function getLearner(session) {
  const info = await call(session.token, 'core_webservice_get_site_info');
  return {
    id: info.userid,
    username: info.username,
    fullname: plain(info.fullname),
    initials: initialsOf(info.fullname),
  };
}

export async function getDashboard(session) {
  const learner = await getLearner(session);

  /* Three independent calls — issued together rather than in sequence,
     because they do not depend on each other and Moodle round trips
     dominate this request. `allSettled`, not `all`: the calendar failing
     should cost the learner their calendar, not their whole dashboard. */
  const [coursesR, eventsR, unreadR] = await Promise.allSettled([
    call(session.token, 'core_enrol_get_users_courses', { userid: learner.id, returnusercount: 0 }),
    call(session.token, 'core_calendar_get_action_events_by_timesort', {
      timesortfrom: Math.floor(Date.now() / 1000),
      timesortto: Math.floor(Date.now() / 1000) + 60 * 86400,
      limitnum: 12,
    }),
    call(session.token, 'message_popup_get_unread_popup_notification_count'),
  ]);

  if (coursesR.status === 'rejected') throw coursesR.reason;

  const courses = (coursesR.value || []).map(normaliseCourse);

  const events = eventsR.status === 'fulfilled'
    ? (eventsR.value?.events || []).map(e => ({
        id: e.id,
        title: plain(e.name),
        when: new Date(e.timesort * 1000).toISOString(),
        courseTitle: plain(e.course?.fullname || ''),
        href: e.url || undefined,
      }))
    : [];

  const recent = courses
    .filter(c => c.lastAccess)
    .sort((a, b) => new Date(b.lastAccess) - new Date(a.lastAccess))
    .slice(0, 3);

  return assertDashboard({
    learner,
    courses,
    /* A learner who has just been enrolled has accessed nothing, and an
       empty "recently accessed" row reads as a broken page. Fall back to
       the first few enrolments so there is always somewhere to click. */
    recent: recent.length ? recent : courses.slice(0, 3),
    events,
    unread: unreadR.status === 'fulfilled' ? Number(unreadR.value ?? 0) : 0,
  });
}

export async function getCourse(session, courseId) {
  const id = Number(courseId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ContractError('courseId', `expected a positive integer, got ${courseId}`);
  }

  const [meta, contents] = await Promise.all([
    call(session.token, 'core_enrol_get_users_courses', { userid: session.userId, returnusercount: 0 }),
    call(session.token, 'core_course_get_contents', { courseid: id }),
  ]);

  const raw = (meta || []).find(c => c.id === id);
  if (!raw) {
    /* Enrolment is the authorisation check. Moodle would refuse the
       contents call anyway, but failing here makes the intent explicit:
       you can only read a course you are actually in. */
    const e = new Error('Not enrolled in that course');
    e.statusCode = 403;
    throw e;
  }

  const sections = (contents || []).map(s => ({
    id: s.id,
    title: plain(s.name),
    summary: plain(s.summary, 300) || undefined,
    activities: (s.modules || []).map(normaliseModule).filter(Boolean),
  })).filter(s => s.activities.length || s.summary);

  return assertCourseDetail({ course: normaliseCourse(raw), sections });
}

/* ── the catalogue pages ─────────────────────────────────────
   "English self-learning" and "Educational Resources" are Moodle course
   CATEGORIES, not courses, and the tracks inside them are courses. So a
   catalogue is one category listing plus its children, grouped.

   Category ids differ per site and must not be guessed — they are set in
   MOODLE_CATEGORY_ENGLISH / MOODLE_CATEGORY_RESOURCES once an admin can
   read them off the site. Until then we resolve by category NAME, which
   is slower but survives a site rebuild. */
const CATALOG_CATEGORIES = {
  english: { env: 'MOODLE_CATEGORY_ENGLISH', name: 'English self-learning' },
  resources: { env: 'MOODLE_CATEGORY_RESOURCES', name: 'Educational Resources' },
};

export async function getCatalog(session, key) {
  const spec = CATALOG_CATEGORIES[key];
  if (!spec) {
    const e = new Error('No such catalogue');
    e.statusCode = 404;
    throw e;
  }

  const configured = process.env[spec.env];
  const categories = await call(session.token, 'core_course_get_categories', {
    criteria: configured
      ? [{ key: 'parent', value: configured }]
      : [{ key: 'name', value: spec.name }],
    addsubcategories: 1,
  });

  if (!Array.isArray(categories) || !categories.length) return { groups: [] };

  /* One call per group rather than one per course: get_courses_by_field
     with a category filter returns every course in that category at once. */
  const groups = await Promise.all(categories
    .filter(c => configured ? String(c.parent) === String(configured) : true)
    .map(async cat => {
      const res = await call(session.token, 'core_course_get_courses_by_field', {
        field: 'category', value: cat.id,
      }).catch(() => ({ courses: [] }));

      return {
        title: plain(cat.name),
        items: (res.courses || []).map(c => ({
          title: plain(c.displayname || c.fullname),
          courseId: c.id,
        })),
      };
    }));

  return { groups: groups.filter(g => g.items.length) };
}

/**
 * A one-time auto-login URL into Moodle, so "Open in Moodle" lands the
 * learner signed in instead of on a login form.
 *
 * This needs the auth_userkey plugin, which an admin has to install and
 * configure. Until then we return a plain deep link and the learner signs
 * in once — degraded, but never broken. docs/MOODLE-SETUP.md covers it.
 */
export async function getSsoUrl(session, target) {
  const fallback = `${config.MOODLE_URL}${target}`;
  try {
    const res = await call(session.token, 'auth_userkey_request_login_url', {
      user: { username: session.username },
    });
    if (!res?.loginurl) return fallback;
    const url = new URL(res.loginurl);
    url.searchParams.set('wantsurl', `${config.MOODLE_URL}${target}`);
    return url.toString();
  } catch {
    return fallback;
  }
}

/** Fetch a Moodle file with the token attached server-side. */
export async function fetchMedia(session, src) {
  const url = new URL(src);
  const base = new URL(config.MOODLE_URL);

  /* The open-redirect / SSRF guard. `src` arrives from the browser, and
     without this check anyone could point the proxy at an internal host
     and have this server fetch it for them with a valid token attached. */
  if (url.origin !== base.origin) {
    const e = new Error('Refusing to proxy a URL outside the Moodle site');
    e.statusCode = 400;
    throw e;
  }

  url.searchParams.set('token', session.token);
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new UpstreamError(`Moodle file returned HTTP ${res.status}`, 502);
  return res;
}

/** Exchange a username and password for a token. The only place a password is touched. */
export async function login(username, password) {
  const body = new URLSearchParams({
    username, password,
    service: config.MOODLE_SERVICE,
  });

  let res;
  try {
    res = await fetch(`${config.MOODLE_URL}/login/token.php`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new UpstreamError('Could not reach Moodle to sign in', 504);
  }

  const json = await res.json().catch(() => null);

  if (!json || json.error || !json.token) {
    /* Deliberately vague to the caller. Moodle distinguishes "no such user"
       from "wrong password" from "account not confirmed", and passing that
       through would turn this endpoint into a way to test which usernames
       exist. The specific errorcode is logged server-side instead. */
    const e = new Error('invalid_credentials');
    e.statusCode = 401;
    e.moodleCode = json?.errorcode || 'unknown';
    throw e;
  }

  return { token: json.token, privateToken: json.privatetoken || null };
}

export { UpstreamError };
