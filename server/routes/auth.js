/* ═══════════════════════════════════════════════════════════
   Sign in, sign out, who am I.

   The learner's password passes through this file exactly once, on its
   way to Moodle, and is never written down: not to a variable that
   outlives the request, not to the session, not to a log. What comes
   back is a token scoped to that learner, which goes straight into the
   sealed cookie.
   ═══════════════════════════════════════════════════════════ */

import { config } from '../config.js';
import { data, isDemo } from '../data/index.js';
import { makeSession, setSession, clearSession, unseal, touchSession } from '../session.js';

/* Deliberately generous on length and permissive on content — Moodle
   allows unicode usernames and this is not the place to invent a
   stricter rule than the system of record has. The limits exist to
   bound work, not to validate. */
const MAX_FIELD = 256;

export default async function authRoutes(app) {
  /* ── POST /api/auth/login ───────────────────────────────── */
  app.post('/login', {
    config: {
      rateLimit: {
        /* Ten attempts per fifteen minutes per IP. Tight enough that
           online password guessing is hopeless, loose enough that a
           classroom of learners behind one school NAT is not locked out
           by a few typos between them — which is a real shape of user
           here, not a hypothetical. */
        max: config.LOGIN_MAX_ATTEMPTS,
        timeWindow: config.LOGIN_WINDOW,
        /* statusCode is not decoration: without it the builder's object
           reaches the error handler with no status and is served as 500.
           A lockout would then be reported to the learner as "something
           went wrong our end" — the front end branches on `kind`, and
           5xx means server fault — when in fact the request was refused
           on purpose and waiting will fix it. */
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'too_many_attempts',
          message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
        }),
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1, maxLength: MAX_FIELD },
          password: { type: 'string', minLength: 1, maxLength: MAX_FIELD },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    if (!config.AUTH_ENABLED) {
      return reply.code(503).send({ error: 'auth_disabled', message: 'Sign-in is temporarily unavailable.' });
    }

    const { username, password } = req.body;

    let token, privateToken;
    try {
      ({ token, privateToken } = await data.login(username.trim(), password));
    } catch (err) {
      /* One response for every kind of failure, and a constant-ish shape:
         no user enumeration, no hint about which half was wrong. The real
         reason is logged, without the credentials. */
      req.log.info({ code: err.moodleCode || err.message, ip: req.ip }, 'sign-in refused');
      return reply.code(401).send({
        error: 'invalid_credentials',
        message: 'That username and password did not match.',
      });
    }

    /* Identity comes from the token, not from what the browser typed —
       the only trustworthy source of who this session belongs to. */
    const learner = await data.getLearner({ token });

    const session = makeSession({
      token, privateToken,
      userId: learner.id,
      username: learner.username || username.trim(),
      fullname: learner.fullname,
    });

    setSession(reply, session);
    req.log.info({ userId: learner.id }, 'signed in');

    return { learner, demo: isDemo };
  });

  /* ── POST /api/auth/logout ──────────────────────────────── */
  app.post('/logout', async (req, reply) => {
    clearSession(reply);
    /* Nothing server-side to revoke: there is no session store, and the
       Moodle token belongs to the learner rather than to us. The sealed
       cookie is the session, so dropping it ends it. Worth stating
       plainly because "logout" that only clears a client cookie is
       usually a bug — here it is the whole design. */
    return { ok: true };
  });

  /* ── GET /api/auth/me ───────────────────────────────────── */
  app.get('/me', async (req, reply) => {
    const session = readSession(req, reply);
    if (!session) return reply.code(401).send({ error: 'unauthorised' });

    return {
      learner: {
        id: session.userId,
        username: session.username,
        fullname: session.fullname,
        initials: initials(session.fullname),
      },
      demo: isDemo,
      expiresAt: new Date(session.exp).toISOString(),
    };
  });
}

/* Shared by every authenticated route — see routes/api.js, which imports it. */
export function readSession(req, reply) {
  const raw = req.cookies?.[config.COOKIE_NAME];
  if (!raw) return null;
  const session = unseal(raw);
  if (!session) {
    /* Present but unopenable: expired, tampered with, or sealed under a
       previous key. Clear it so the browser stops sending a cookie that
       can only ever fail. */
    clearSession(reply);
    return null;
  }
  return touchSession(reply, session);
}

function initials(fullname) {
  const parts = String(fullname || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
