/* ═══════════════════════════════════════════════════════════
   Configuration — read once, validated once, at boot.

   The rule here is fail loud, fail early. A misconfigured auth
   server that starts anyway and silently accepts everyone is
   worse than one that refuses to boot, so every required value
   is checked before the first request is ever served.
   ═══════════════════════════════════════════════════════════ */

import { randomBytes } from 'node:crypto';

const problems = [];

function required(name, why) {
  const v = process.env[name];
  if (!v || !v.trim()) problems.push(`${name} is not set — ${why}`);
  return (v || '').trim();
}

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

const NODE_ENV = optional('NODE_ENV', 'development');
const isProd = NODE_ENV === 'production';

/* Where the learner records actually live.

   'mock'   — the catalogue from CONTENT.md, served from memory. No network,
              no credentials, no personal data. This is what the site runs on
              until Pacific Links provisions a Moodle web-services account.
   'moodle' — the real thing: glow.mata9.com over its web services API.

   Everything above the adapter is identical in both modes, which is the point:
   the front end is finished and testable before the credentials arrive, and
   going live is a change of this one variable. */
const DATA_SOURCE = optional('DATA_SOURCE', 'mock');
if (!['mock', 'moodle'].includes(DATA_SOURCE)) {
  problems.push(`DATA_SOURCE must be "mock" or "moodle", got "${DATA_SOURCE}"`);
}
const live = DATA_SOURCE === 'moodle';

/* ── the session key ─────────────────────────────────────────
   32 bytes, base64. This key encrypts the Moodle token inside the
   session cookie, so leaking it is equivalent to leaking every live
   session. It belongs in the host's secret store, never in git.

   In development we generate an ephemeral one so `npm run dev` works
   with no setup; the cost is that restarting the server logs you out,
   which is the correct trade for not shipping a default key. A default
   key that works in production is how staging secrets end up live. */
let SESSION_SECRET = optional('SESSION_SECRET', '');
if (!SESSION_SECRET) {
  if (isProd) {
    problems.push('SESSION_SECRET is not set — generate one with: node tools/gen-secret.mjs');
  } else {
    SESSION_SECRET = randomBytes(32).toString('base64');
    console.warn('[config] SESSION_SECRET not set — using a random development key.\n' +
                 '         Sessions will not survive a restart. This is expected in dev.');
  }
}
if (SESSION_SECRET) {
  const bytes = Buffer.from(SESSION_SECRET, 'base64');
  if (bytes.length !== 32) {
    problems.push(`SESSION_SECRET must decode to exactly 32 bytes, got ${bytes.length}. ` +
                  'Generate one with: node tools/gen-secret.mjs');
  }
}

/* ── Moodle ──────────────────────────────────────────────────
   MOODLE_URL is the site root, no trailing slash and no /webservice
   path: we append the endpoints ourselves so a typo cannot silently
   point token requests at a different host than data requests. */
const MOODLE_URL = live
  ? required('MOODLE_URL', 'the Moodle site to authenticate against, e.g. https://glow.mata9.com')
  : optional('MOODLE_URL', '');

if (MOODLE_URL) {
  if (!/^https:\/\//i.test(MOODLE_URL) && isProd) {
    problems.push('MOODLE_URL must be https:// — the learner password is forwarded over it');
  }
  if (MOODLE_URL.endsWith('/')) {
    problems.push('MOODLE_URL must not end in a slash');
  }
}

/* The Moodle "external service" shortname our token is issued against.
   moodle_mobile_app is the one every Moodle enables for its own mobile
   app, so it exists without an admin creating anything. A dedicated
   service with only the functions we call is better practice — see
   docs/MOODLE-SETUP.md — and is what MOODLE_SERVICE is for. */
const MOODLE_SERVICE = optional('MOODLE_SERVICE', 'moodle_mobile_app');

/* Public origin of THIS server. Used for two things that both matter:
   marking cookies Secure, and rejecting cross-site state changes. */
const PUBLIC_ORIGIN = optional('PUBLIC_ORIGIN', '');
if (isProd && !PUBLIC_ORIGIN) {
  problems.push('PUBLIC_ORIGIN is not set — required in production for CSRF origin checks, ' +
                'e.g. https://glow.example.org');
}

const PORT = Number(optional('PORT', '8080'));
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  problems.push(`PORT must be a valid port number, got "${process.env.PORT}"`);
}

if (problems.length) {
  console.error('\n  Cannot start — configuration problems:\n');
  for (const p of problems) console.error(`   • ${p}`);
  console.error('\n  See docs/DEPLOY.md for the full list of environment variables.\n');
  process.exit(1);
}

export const config = {
  NODE_ENV,
  isProd,
  PORT,
  HOST: optional('HOST', '0.0.0.0'),
  PUBLIC_ORIGIN,

  DATA_SOURCE,
  live,

  SESSION_SECRET: Buffer.from(SESSION_SECRET, 'base64'),
  /* Eight hours. Long enough that a learner working through a course is not
     thrown out mid-quiz, short enough that a shared or public computer does
     not stay signed in overnight. Refreshed on activity, see session.js. */
  SESSION_TTL_MS: Number(optional('SESSION_TTL_MINUTES', '480')) * 60_000,
  COOKIE_NAME: 'glow_session',

  MOODLE_URL,
  MOODLE_SERVICE,

  /* Where the built front end is served from. */
  STATIC_DIR: optional('STATIC_DIR', 'dist'),

  /* How many proxies sit in front of this process — NOT a boolean. Fastify
     trusts the rightmost N entries of X-Forwarded-For and throws away the
     rest, which is what stops a caller writing their own client IP and
     handing themselves a fresh login-rate-limit bucket on every attempt.
     One is right for Netlify and for Render. Set it higher only if you
     knowingly added a hop (your own CDN in front of the host); setting it
     too high hands the spoofing problem straight back. */
  TRUST_PROXY: Number(optional('TRUST_PROXY', '1')) || 1,

  /* Login throttling. Kept configurable rather than hardcoded because the
     right number depends on how the learners reach the site: GLOW's users
     are frequently on shared connections — a school, a community centre,
     one mobile hotspot for a group — where every one of them presents the
     same IP. Too tight and a handful of typos locks out the room.

     If that turns out to be common, the better shape is a per-username
     limit alongside this one, so a single account being guessed cannot
     cost everyone else their sign-in. Noted in docs/OPERATIONS.md. */
  LOGIN_MAX_ATTEMPTS: Number(optional('LOGIN_MAX_ATTEMPTS', '10')),
  LOGIN_WINDOW: optional('LOGIN_WINDOW', '15 minutes'),

  /* Turning this off disables the login form entirely and serves the
     marketing page only — the switch to flip if credentials are ever
     suspected of being compromised. */
  AUTH_ENABLED: optional('AUTH_ENABLED', 'true') !== 'false',
};
