/* ═══════════════════════════════════════════════════════════
   The catalogue routes. PUBLIC: the session is optional, and only
   changes what the viewer may see (role-gated courses) and whether
   progress is attached. A course the viewer may not see is a 404 —
   it does not exist for them.
   ═══════════════════════════════════════════════════════════ */

import { isDemo, data } from '../data/index.js';
import { catalogueFor, courseByCode, canSee } from '../data/catalogue.js';
import { SUMMARIES } from '../data/course-summaries.js';
import { readSession } from './auth.js';

const moodlePathOf = c => (c.moodleId ? `/course/view.php?id=${c.moodleId}` : undefined);

/* The dashboard's courses, by code and by Moodle id, for progress. */
async function enrolments(session) {
  try {
    const { courses } = await data.getDashboard(session);
    return courses;
  } catch {
    return [];
  }
}

export default async function catalogueRoutes(app) {
  /* ── GET /api/catalogue ─────────────────────────────────── */
  app.get('/', async (req, reply) => {
    const session = readSession(req, reply);
    const role = session ? (session.role || 'learner') : null;
    const mine = session ? await enrolments(session) : [];
    const progressOf = c => {
      const m = mine.find(x => x.code === c.code || (c.moodleId && x.id === c.moodleId));
      return m ? m.progress : null;
    };

    const cat = catalogueFor(role);
    return {
      role,
      ...cat,
      courses: cat.courses.map(c => ({ ...c, moodlePath: moodlePathOf(c), progress: session ? progressOf(c) : null })),
      demo: isDemo,
    };
  });

  /* ── GET /api/catalogue/courses/:code ───────────────────── */
  app.get('/courses/:code', {
    schema: { params: { type: 'object', properties: { code: { type: 'string', pattern: '^[A-Za-z0-9]{2,12}$' } }, required: ['code'] } },
  }, async (req, reply) => {
    const session = readSession(req, reply);
    const role = session ? (session.role || 'learner') : null;
    const c = courseByCode(req.params.code);
    if (!c || !canSee(c, role)) return reply.code(404).send({ error: 'not_found' });

    const course = { ...c, moodlePath: moodlePathOf(c), progress: null, enrolled: false, summary: SUMMARIES[c.code] || null };
    let sections = [];
    if (session && c.moodleId) {
      try {
        const d = await data.getCourse(session, c.moodleId);
        sections = d.sections;
        course.progress = d.course.progress;
        course.enrolled = d.course.enrolled;
      } catch { /* not enrolled, or Moodle is down: the page shows the filler panel */ }
    }
    return { course, sections, role, demo: isDemo };
  });
}
