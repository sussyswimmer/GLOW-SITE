/* Pre-flight check. Run before a deploy, or when something will not start:
     node --env-file-if-exists=.env tools/check-config.mjs
     npm run check

   It validates the environment WITHOUT starting a server or opening a port,
   and it tells you what is wrong in plain language rather than a stack
   trace. Safe to run in production — it makes one read-only call to Moodle
   and never touches learner data. */

const problems = [];
const notes = [];
const ok = [];

const env = (k, d = '') => (process.env[k] || d).trim();

const NODE_ENV = env('NODE_ENV', 'development');
const isProd = NODE_ENV === 'production';
const DATA_SOURCE = env('DATA_SOURCE', 'mock');

console.log(`\n  GLOW configuration check — NODE_ENV=${NODE_ENV}, DATA_SOURCE=${DATA_SOURCE}\n`);

/* ── node ────────────────────────────────────────────────── */
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) problems.push(`Node ${process.versions.node} is too old — 20.11 or newer is required`);
else ok.push(`Node ${process.versions.node}`);

/* ── data source ─────────────────────────────────────────── */
if (!['mock', 'moodle'].includes(DATA_SOURCE)) {
  problems.push(`DATA_SOURCE must be "mock" or "moodle", got "${DATA_SOURCE}"`);
} else if (DATA_SOURCE === 'mock') {
  notes.push('Running on SAMPLE DATA. Every page will show a "sample data" banner. ' +
             'To go live see docs/MOODLE-SETUP.md.');
  if (isProd) problems.push('NODE_ENV=production with DATA_SOURCE=mock — real learners would see demo content');
} else {
  ok.push('DATA_SOURCE=moodle');
}

/* ── session key ─────────────────────────────────────────── */
const secret = env('SESSION_SECRET');
if (!secret) {
  if (isProd) problems.push('SESSION_SECRET is not set — generate one with: npm run secret');
  else notes.push('SESSION_SECRET not set — a throwaway key is used in development');
} else {
  const bytes = Buffer.from(secret, 'base64');
  if (bytes.length !== 32) {
    problems.push(`SESSION_SECRET must decode to 32 bytes, got ${bytes.length}. Generate: npm run secret`);
  } else if (/^(A|0)+={0,2}$/.test(secret)) {
    problems.push('SESSION_SECRET is all one character — that is not a random key');
  } else {
    ok.push('SESSION_SECRET is 32 bytes');
  }
}

/* ── public origin ───────────────────────────────────────── */
const origin = env('PUBLIC_ORIGIN');
if (!origin) {
  if (isProd) problems.push('PUBLIC_ORIGIN is not set — required in production for CSRF origin checks');
  else notes.push('PUBLIC_ORIGIN not set — fine in development');
} else if (isProd && !origin.startsWith('https://')) {
  problems.push(`PUBLIC_ORIGIN must be https:// in production, got "${origin}"`);
} else if (origin.endsWith('/')) {
  problems.push('PUBLIC_ORIGIN must not end in a slash');
} else {
  ok.push(`PUBLIC_ORIGIN=${origin}`);
}

/* ── moodle ──────────────────────────────────────────────── */
const moodle = env('MOODLE_URL');
if (DATA_SOURCE === 'moodle') {
  if (!moodle) problems.push('MOODLE_URL is required when DATA_SOURCE=moodle');
  else if (moodle.endsWith('/')) problems.push('MOODLE_URL must not end in a slash');
  else if (isProd && !moodle.startsWith('https://')) {
    problems.push('MOODLE_URL must be https:// — the learner password is forwarded over it');
  } else {
    ok.push(`MOODLE_URL=${moodle}`);

    /* One read-only reachability probe: a token request with empty
       credentials. No password is sent anywhere and nothing is changed.

       WHAT THIS CAN AND CANNOT TELL US. Moodle checks the credentials
       BEFORE it checks the service name, so an empty login returns
       `invalidlogin` for a real service and for a nonsense one alike —
       verified against the live site. This probe therefore proves the host
       answers and that web services are switched on, and it CANNOT confirm
       the service name. Saying otherwise would be false reassurance at
       exactly the moment someone is trying to find out why sign-in fails,
       so it deliberately does not. Only a real sign-in validates the
       service; docs/MOODLE-SETUP.md says to do that as the final step. */
    const service = env('MOODLE_SERVICE', 'moodle_mobile_app');
    try {
      const res = await fetch(`${moodle}/login/token.php`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: '', password: '', service }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        problems.push(`Moodle answered HTTP ${res.status} at ${moodle}/login/token.php`);
      } else if (body?.errorcode === 'enablewsdescription' || /web services.*not.*enabled/i.test(body?.error || '')) {
        problems.push('Moodle has web services DISABLED — see docs/MOODLE-SETUP.md step 1');
      } else if (body?.errorcode === 'invalidlogin') {
        ok.push('Moodle reachable and web services are enabled');
        notes.push(`Service "${service}" could NOT be verified from here — Moodle checks credentials ` +
                   'first. Confirm it by signing in with a real learner account.');
      } else {
        notes.push(`Moodle answered with an unexpected code "${body?.errorcode || '?'}" — ` +
                   'not necessarily wrong, but worth a look');
      }
    } catch (err) {
      problems.push(`Could not reach ${moodle} — ${err.name === 'TimeoutError' ? 'timed out' : err.message}`);
    }
  }
}

/* ── throttling ──────────────────────────────────────────── */
const attempts = Number(env('LOGIN_MAX_ATTEMPTS', '10'));
if (!Number.isInteger(attempts) || attempts < 1) {
  problems.push(`LOGIN_MAX_ATTEMPTS must be a positive integer, got "${env('LOGIN_MAX_ATTEMPTS')}"`);
} else if (attempts > 50) {
  notes.push(`LOGIN_MAX_ATTEMPTS=${attempts} is high — that is a lot of password guesses per window`);
} else {
  ok.push(`LOGIN_MAX_ATTEMPTS=${attempts}`);
}

if (env('AUTH_ENABLED', 'true') === 'false') {
  notes.push('AUTH_ENABLED=false — sign-in is switched OFF and only the public page is served');
}

/* ── report ──────────────────────────────────────────────── */
for (const o of ok) console.log(`   ✓ ${o}`);
for (const n of notes) console.log(`   • ${n}`);
for (const p of problems) console.log(`   ✗ ${p}`);

console.log(problems.length
  ? `\n  ${problems.length} problem(s). The server will refuse to start. See docs/DEPLOY.md.\n`
  : '\n  Configuration looks good.\n');

process.exitCode = problems.length ? 1 : 0;
