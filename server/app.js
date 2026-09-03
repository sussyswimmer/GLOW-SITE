/* ═══════════════════════════════════════════════════════════
   GLOW — the app, built but not listening.

   One app serves both halves: the built front end as static files
   and /api on the same origin. That is a deliberate simplification for
   a foundation that has to operate this without a platform team —
   one deployable, one URL, one log, one thing that can be down. It
   also removes CORS from the picture entirely, and with it the usual
   family of misconfigurations where a permissive Access-Control header
   quietly makes an authenticated API readable from anywhere.

   Construction is separated from listening for one reason: a serverless
   host has no process to listen on. `server/index.js` builds this and
   calls listen; `netlify/functions/api.mjs` builds it with
   `serveStatic: false` and hands it one request at a time, because on
   that host the CDN is already serving the files. The routes, the
   session handling, the CSRF check and the error shape are the same
   object either way — there is no second implementation to keep in step.
   ═══════════════════════════════════════════════════════════ */

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { config } from './config.js';
import { isDemo } from './data/index.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

export async function buildApp({ serveStatic = true, logger } = {}) {
  const app = Fastify({
    /* trustProxy matters behind any managed host: without it every request
       appears to come from the load balancer, which would make the login
       rate limiter count all learners as one client and lock out the site
       the first time someone fat-fingered a password.

       A COUNT, never `true`. `true` trusts the whole X-Forwarded-For chain
       and takes its LEFTMOST entry as the client — but hosts APPEND the
       address they observed, so the leftmost entry is whatever the caller
       chose to put there. That made the login lockout a formality: send a
       different X-Forwarded-For each time and every attempt gets a fresh
       bucket. Verified against the live deployment before this changed —
       a locked-out IP went back to 401 the moment a header was added.

       The count is how many proxies sit in front of this process, so the
       rightmost N entries are the ones they wrote and everything the caller
       supplied is discarded. One for Netlify, one for Render; raise it only
       if you knowingly put another hop in front. */
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 64 * 1024,
    logger: logger ?? {
      level: config.isProd ? 'info' : 'debug',
      /* Passwords and tokens must never reach a log file. Fastify logs the
         request, so the redaction list is the safety net for the day someone
         adds a log line without thinking about what is in scope. */
      redact: {
        paths: [
          'req.headers.cookie', 'req.headers.authorization',
          'req.body.password', 'req.body.username',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
      serializers: {
        req: r => ({ method: r.method, url: r.url.split('?')[0], ip: r.ip }),
      },
    },
  });

  /* ── headers ─────────────────────────────────────────────── */
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        /* The pages carry a handful of style attributes and the language
           cascade writes inline transforms, so style-src cannot be locked
           to 'self' without rewriting the animation layer. Inline STYLE is
           a far weaker vector than inline script, which stays blocked. */
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],       // no clickjacking the login form
        formAction: ["'self'"],
        baseUri: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    /* Two years, and only once HTTPS is genuinely in place — HSTS on a
       host that later loses its certificate makes the site unreachable
       rather than merely insecure. */
    hsts: config.isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: false } : false,
    crossOriginEmbedderPolicy: false,     // would block the Google Fonts stylesheet
    referrerPolicy: { policy: 'same-origin' },
  });

  await app.register(cookie, {
    parseOptions: { httpOnly: true, sameSite: 'lax', path: '/' },
  });

  await app.register(rateLimit, {
    global: false,                        // opted into per-route, see auth.js
    /* Keyed on the real client IP, which is why trustProxy is on above. */
    keyGenerator: req => req.ip,
  });

  /* ── CSRF: origin checking ───────────────────────────────────
     The session cookie is SameSite=Lax, which already stops a cross-site
     form POST from carrying it. This is the second lock: any state-changing
     request must state an Origin, and it must be ours.

     Chosen over a token-in-a-hidden-field scheme because there is nothing
     to plumb through the front end, nothing to expire, and no way to forget
     it on a new route — it is enforced here for every method that changes
     something, whether or not the route's author thought about it. */
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;

    const origin = req.headers.origin;
    const expected = config.PUBLIC_ORIGIN || `${req.protocol}://${req.headers.host}`;

    if (!origin) {
      /* No Origin at all is a non-browser client — curl, a health checker, a
         server-to-server call. Those cannot be CSRF'd because there is no
         ambient cookie, so they are allowed through in development. In
         production we require it, because every legitimate caller is a
         browser we control. */
      if (config.isProd) return reply.code(403).send({ error: 'origin_required' });
      return;
    }

    if (origin !== expected) {
      req.log.warn({ origin, expected }, 'rejected cross-origin state change');
      return reply.code(403).send({ error: 'bad_origin' });
    }
  });

  /* ── routes ──────────────────────────────────────────────── */
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(apiRoutes, { prefix: '/api' });

  app.get('/api/health', async () => ({
    ok: true,
    mode: config.DATA_SOURCE,
    demo: isDemo,
    version: process.env.npm_package_version || 'dev',
  }));

  /* ── the front end ───────────────────────────────────────── */
  const staticRoot = resolve(process.cwd(), config.STATIC_DIR);
  const hasStatic = serveStatic && existsSync(staticRoot);

  if (hasStatic) {
    await app.register(fastifyStatic, {
      root: staticRoot,
      /* The HTML shells must not be cached hard: they are the only files
         without a content hash in the name, so a stale one pins a learner
         to a deleted JS bundle. Everything under /assets IS hashed and can
         be cached for a year. */
      setHeaders(res, path) {
        if (path.endsWith('.html')) res.setHeader('cache-control', 'no-cache');
        else if (path.includes(`${'assets'}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      },
    });
  } else if (serveStatic) {
    app.log.warn(`No build found at ${staticRoot} — run "npm run build" first. Serving the API only.`);
  }

  /* A 404 for an /api path is JSON; anything else is a person who typed a
     URL, and should get the site rather than a stack trace. Where the CDN is
     serving the files this app never sees such a request at all, and cannot
     answer it with a file it does not have. */
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found' });
    if (hasStatic && existsSync(resolve(staticRoot, 'index.html'))) return reply.sendFile('index.html');
    return reply.code(404).type('text/plain').send('Not found');
  });

  /* One error shape out of the whole API. The message is only forwarded
     when a route deliberately marked it safe to show — otherwise the
     client gets a code and the detail goes to the log, so an upstream
     error can never narrate our internals to a stranger. */
  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, 'request failed');
    else req.log.info({ err: err.message }, 'request rejected');

    reply.code(status).send({
      error: err.code || (status === 401 ? 'unauthorised' : status === 403 ? 'forbidden' : status >= 500 ? 'server_error' : 'bad_request'),
      message: err.expose ? err.message : undefined,
    });
  });

  return app;
}
