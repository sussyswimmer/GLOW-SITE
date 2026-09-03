/* ═══════════════════════════════════════════════════════════
   The data routes. Everything here requires a session; the guard is
   registered as a hook rather than repeated per route, so a new route
   added to this file is authenticated by default rather than by the
   author remembering to say so.
   ═══════════════════════════════════════════════════════════ */

import { config } from '../config.js';
import { data, isDemo } from '../data/index.js';
import { readSession } from './auth.js';

export default async function apiRoutes(app) {
  app.addHook('preHandler', async (req, reply) => {
    const session = readSession(req, reply);
    if (!session) {
      return reply.code(401).send({ error: 'unauthorised', message: 'Please sign in again.' });
    }
    req.session = session;
  });

  /* ── GET /api/dashboard ─────────────────────────────────── */
  app.get('/dashboard', async (req) => {
    const d = await data.getDashboard(req.session);
    return { ...d, demo: isDemo };
  });

  /* ── GET /api/courses ───────────────────────────────────── */
  app.get('/courses', async (req) => {
    const d = await data.getDashboard(req.session);
    /* Grouped the way the page renders them, so the client is not
       re-deriving a taxonomy it would then have to keep in step. */
    const groups = new Map();
    for (const c of d.courses) {
      const key = c.category || 'Courses';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    return {
      demo: isDemo,
      groups: [...groups].map(([title, courses]) => ({ title, courses })),
    };
  });

  /* ── GET /api/courses/:id ───────────────────────────────── */
  app.get('/courses/:id', {
    schema: { params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'] } },
  }, async (req) => {
    const d = await data.getCourse(req.session, req.params.id);
    return { ...d, demo: isDemo };
  });

  /* ── GET /api/catalog/:key ──────────────────────────────── */
  app.get('/catalog/:key', {
    schema: { params: { type: 'object', properties: { key: { type: 'string', enum: ['english', 'resources'] } }, required: ['key'] } },
  }, async (req) => {
    const d = await data.getCatalog(req.session, req.params.key);
    return { ...d, demo: isDemo };
  });

  /* ── GET /api/sso?to=/mod/quiz/view.php?id=12 ─────────────
     The bridge for everything that stays in Moodle — quizzes,
     assignments, the ETOP scheduler, forums. The learner clicks a row
     here and arrives there already signed in.

     `to` is attacker-controlled, so it is constrained to a site-relative
     path. Without that check this route is an open redirect wearing a
     login: a link to our trusted domain that lands on someone else's
     page, which is exactly the shape a phishing mail wants. */
  app.get('/sso', {
    schema: { querystring: { type: 'object', properties: { to: { type: 'string', maxLength: 512 } }, required: ['to'] } },
  }, async (req, reply) => {
    const to = req.query.to;

    if (!to.startsWith('/') || to.startsWith('//') || to.includes('\\') || /[\r\n]/.test(to)) {
      return reply.code(400).send({ error: 'bad_target' });
    }

    const url = await data.getSsoUrl(req.session, to);
    /* One-time login URLs must never be cached or sit in a shared proxy. */
    reply.header('cache-control', 'no-store');
    return reply.redirect(url, 302);
  });

  /* ── GET /api/media?src=… ───────────────────────────────
     Course images live behind Moodle's pluginfile.php, which wants the
     web-services token as a query parameter. Fetching them here keeps
     that token server-side; the alternative is putting a live credential
     into an <img src> where devtools, the referrer header and every
     proxy in between can read it. */
  app.get('/media', {
    schema: { querystring: { type: 'object', properties: { src: { type: 'string', maxLength: 1024 } }, required: ['src'] } },
  }, async (req, reply) => {
    if (!config.live) return reply.code(404).send({ error: 'not_found' });

    const upstream = await data.fetchMedia(req.session, req.query.src);

    const type = upstream.headers.get('content-type') || 'application/octet-stream';
    /* Only ever hand back images. Without this the proxy would happily
       relay an HTML file from the Moodle host under OUR origin, which
       would let it run scripts against our cookies. */
    if (!/^image\//i.test(type)) return reply.code(415).send({ error: 'unsupported_media' });

    reply.header('content-type', type);
    reply.header('cache-control', 'private, max-age=3600');
    reply.header('content-security-policy', "default-src 'none'; sandbox");
    reply.header('x-content-type-options', 'nosniff');
    return reply.send(Buffer.from(await upstream.arrayBuffer()));
  });
}
