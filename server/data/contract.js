/* ═══════════════════════════════════════════════════════════
   The data contract.

   One shape, two producers. `mock.js` invents it from the catalogue
   in CONTENT.md; `moodle.js` derives it from live web-services calls.
   Every route and every line of front-end code is written against
   THIS file and never against Moodle's own response shapes.

   Why that indirection is worth it here: Moodle web services return
   wide, inconsistent objects — some functions give you `id`, some
   `courseid`, completion state is a number whose meaning depends on
   `completionexpected`, and half the strings arrive as HTML. Letting
   that leak into the front end would mean the pages could not be built
   or tested until the credentials landed, and would tie the design to
   a backend the foundation may want to move off later.

   Normalising once, here, means the day the token arrives is a
   configuration change and not a rewrite.

   EVERY FIELD BELOW IS ALSO A PROMISE TO THE FRONT END. If a shape
   changes, change it here and both producers fail their validation
   loudly, rather than one page quietly rendering empty.
   ═══════════════════════════════════════════════════════════ */

/**
 * @typedef {object} Learner
 * @property {number}  id        Moodle user id
 * @property {string}  username  login name
 * @property {string}  fullname  display name, already HTML-decoded
 * @property {string}  initials  1–2 chars for the avatar chip
 * @property {string=} idnumber  the institutional ID shown under the name
 */

/**
 * @typedef {object} Course
 * @property {number}  id
 * @property {string}  code       short name, e.g. "EMM231" — shown as the tile chip
 * @property {string}  title      full name
 * @property {string}  summary    one line, plain text, no markup
 * @property {string=} image      absolute or site-relative cover image URL
 * @property {number}  progress   0–100 integer. Moodle reports null for courses
 *                                with no completion tracking; we send 0 and set
 *                                `tracked:false` so the UI can hide the bar rather
 *                                than claim the learner has done nothing.
 * @property {boolean} tracked    whether progress is meaningful at all
 * @property {string}  category   e.g. "Upskilling Development", "ETOP"
 * @property {boolean} enrolled
 * @property {string=} lastAccess ISO date, for "recently accessed"
 * @property {string=} moodlePath site-relative path to this course on the
 *                                platform, e.g. "/course/view.php?id=241".
 *                                Passed to /api/sso so "Open in Moodle"
 *                                arrives signed in. Site-relative is a
 *                                security property, not a style: /api/sso
 *                                refuses absolute targets so the bridge
 *                                cannot be turned into an open redirect.
 * @property {boolean=} contentInMoodle  true when this rebuild has no
 *                                interior for the course and Moodle is
 *                                where the material actually is. The UI
 *                                says so instead of showing "no content
 *                                yet", which would read as "empty".
 */

/**
 * @typedef {object} Activity   one row inside a course section
 * @property {number}  id
 * @property {string}  title
 * @property {string}  type      normalised: url | file | page | quiz | assign |
 *                               forum | scheduler | folder | other
 * @property {string}  typeLabel human label for the chip, already localised-neutral
 * @property {string=} href      where the row actually goes. NEVER "#" — a row
 *                               with nothing behind it must omit href, and the UI
 *                               renders it as plainly unavailable instead of as a
 *                               link that lies.
 * @property {boolean} external  true when href leaves for Moodle or a third party
 * @property {'done'|'todo'|'none'} completion
 * @property {string=} due       ISO date
 */

/**
 * @typedef {object} Section
 * @property {number}    id
 * @property {string}    title
 * @property {string=}   summary
 * @property {Activity[]} activities
 */

/**
 * @typedef {object} CourseDetail
 * @property {Course}    course
 * @property {Section[]} sections
 */

/**
 * @typedef {object} CalendarEvent
 * @property {number}  id
 * @property {string}  title
 * @property {string}  when      ISO datetime
 * @property {string=} courseTitle
 * @property {string=} href
 */

/**
 * @typedef {object} Dashboard
 * @property {Learner}       learner
 * @property {Course[]}      recent      most recently accessed, max 3
 * @property {Course[]}      courses     everything they are enrolled in
 * @property {CalendarEvent[]} events    upcoming, next 60 days
 * @property {number}        unread      notification count for the bell
 */

/* ── validation ──────────────────────────────────────────────
   Cheap structural checks run on everything an adapter produces.
   The point is not type safety, it is a loud failure at the seam:
   when the live Moodle returns something unexpected, we want a log
   line naming the field, not a dashboard that renders three empty
   boxes and looks like a CSS bug. */

class ContractError extends Error {
  constructor(what, detail) {
    super(`data contract: ${what} — ${detail}`);
    this.name = 'ContractError';
    this.statusCode = 502;   // it is the upstream that is wrong, not the caller
  }
}

const isStr = v => typeof v === 'string';
const isNum = v => typeof v === 'number' && Number.isFinite(v);

export function assertLearner(l) {
  if (!l || !isNum(l.id) || !isStr(l.fullname)) {
    throw new ContractError('learner', `expected {id:number, fullname:string}, got ${peek(l)}`);
  }
  return l;
}

export function assertCourse(c) {
  if (!c || !isNum(c.id) || !isStr(c.title)) {
    throw new ContractError('course', `expected {id:number, title:string}, got ${peek(c)}`);
  }
  if (!isNum(c.progress) || c.progress < 0 || c.progress > 100) {
    throw new ContractError('course.progress', `expected 0–100 for "${c.title}", got ${peek(c.progress)}`);
  }
  return c;
}

export function assertActivity(a) {
  if (!a || !isStr(a.title) || !isStr(a.type)) {
    throw new ContractError('activity', `expected {title:string, type:string}, got ${peek(a)}`);
  }
  /* The rule this whole rebuild exists to enforce. The prototype shipped 87
     links to "#"; a link that goes nowhere is worse than no link, because the
     learner cannot tell the difference between broken and not-yet-started. */
  if (a.href === '#' || a.href === '') {
    throw new ContractError('activity.href',
      `"${a.title}" has a placeholder href. Omit href entirely for an activity ` +
      'with no destination — the UI renders that as unavailable.');
  }
  return a;
}

export function assertDashboard(d) {
  assertLearner(d?.learner);
  if (!Array.isArray(d.courses)) throw new ContractError('dashboard.courses', 'expected an array');
  if (!Array.isArray(d.recent)) throw new ContractError('dashboard.recent', 'expected an array');
  if (!Array.isArray(d.events)) throw new ContractError('dashboard.events', 'expected an array');
  d.courses.forEach(assertCourse);
  d.recent.forEach(assertCourse);
  return d;
}

export function assertCourseDetail(d) {
  assertCourse(d?.course);
  if (!Array.isArray(d.sections)) throw new ContractError('courseDetail.sections', 'expected an array');
  for (const s of d.sections) {
    if (!isStr(s.title)) throw new ContractError('section.title', `expected a string, got ${peek(s?.title)}`);
    if (!Array.isArray(s.activities)) throw new ContractError('section.activities', 'expected an array');
    s.activities.forEach(assertActivity);
  }
  return d;
}

/* A short, safe rendering of a bad value for the log. Deliberately
   truncated: upstream payloads can contain learner data, and an error
   log is one of the easiest places to leak it by accident. */
function peek(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  const s = typeof v === 'object' ? `${Array.isArray(v) ? 'array' : 'object'}(${Object.keys(v).slice(0, 6).join(',')})` : String(v);
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}

export { ContractError };
