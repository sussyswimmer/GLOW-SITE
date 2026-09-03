# How GLOW is put together

Written for whoever inherits this. It explains the decisions, not just the
layout, because the layout is readable from the files and the decisions are
not.

---

## The shape

```
  Learner's browser
        │  HTTPS, session cookie (HttpOnly, encrypted, SameSite=Lax)
        ▼
  ┌─────────────────────────────┐
  │  This server (Node/Fastify) │   Serves dist/ AND /api on one origin.
  │                             │   Holds NO data. No database.
  │  ┌───────────────────────┐  │
  │  │  data adapter          │  │   mock  ← the catalogue, in memory
  │  │  (one interface)       │  │   moodle ← live web services
  │  └───────────────────────┘  │
  └─────────────┬───────────────┘
                │  Moodle web services, as the learner's own token
                ▼
      Moodle — glow.mata9.com
      Every learner record, course, grade and quiz. The system of record.
```

## The four decisions that shaped it

### 1. Moodle stays the system of record

The alternative was a custom backend with its own user table, and migrating
everyone off Moodle onto it.

Rejected, because it would have meant rebuilding — and then maintaining
forever — password reset, roles and permissions, quizzes, the gradebook, and
GDPR data-request tooling, all of which Moodle already has and a global
security team already patches. For a foundation without a platform team,
that is a liability disguised as a feature.

The cost is real and worth stating: the site is bound to Moodle's data
model, and a Moodle upgrade that changes the web-services API can break it.
That trade is documented in `docs/HANDOFF.md`'s risk list.

### 2. This tier stores nothing

**No database. No session store. No user table. No logs containing personal
data.**

The session is a sealed, encrypted cookie held by the browser; the server
keeps only the key that opens it (`server/session.js`). Everything about a
learner comes from Moodle on demand and is never written down here.

Consequences, all of them good for this client:

- There is no store to breach. This tier is not worth attacking.
- There is nothing to back up, and no restore procedure to get wrong.
- There is no second copy of learner data to keep lawful, and no GDPR export
  to build — Moodle's existing tooling remains the single answer.
- Deploys and rollbacks are always safe: no migrations, no state.

Given who GLOW serves — young people including participants in an
anti-trafficking programme — the best way to protect their data here was to
decline to hold any of it.

### 3. Every call is made as the learner

There is no site-wide admin token anywhere. Signing in exchanges the
learner's own credentials for a token scoped to *them*, and every subsequent
Moodle call uses it.

So Moodle's permission checks apply to every request, and a bug in this
codebase cannot read data the learner could not already see by logging into
Moodle directly. Authorisation is not reimplemented here; it is inherited.

### 4. One adapter interface, two implementations

`server/data/contract.js` defines the shape. `mock.js` and `moodle.js` both
produce it, and nothing above them knows which is running.

This was forced by circumstance — the work started before Moodle credentials
existed — but it earned its keep: the entire site was built, reviewed and
tested end to end before the platform was reachable, and going live is one
environment variable. It also means the foundation is not locked in. If they
ever move off Moodle, one file is rewritten and nothing else changes.

The mock is not a toy. It carries the real course catalogue from
`CONTENT.md`, and it flags itself: every response includes `demo: true` and
the UI shows an undismissable banner. That flag is the only thing standing
between a demo and the foundation believing it is looking at its own
learners, so it is derived from configuration and cannot be switched off
independently.

---

## Security, concretely

| Concern | How |
|---|---|
| Password handling | Forwarded to Moodle once, never stored, never logged, cleared from the DOM after submit |
| Session | AES-256-GCM sealed cookie; HttpOnly, Secure, SameSite=Lax; 8h sliding expiry held *inside* the sealed payload, not in a cookie attribute the user can edit |
| Moodle token | Only ever inside the sealed cookie and in server memory. Never in a URL, an `<img src>`, or any log |
| CSRF | SameSite=Lax **plus** an Origin check on every non-GET, enforced in one hook so a new route cannot forget it |
| XSS | No `innerHTML` from data anywhere. All text via `textContent`; CSP blocks inline script |
| Brute force | Login rate-limited per IP, configurable because learners share connections |
| User enumeration | "No such user" and "wrong password" are byte-identical responses. Tested |
| Open redirect | The SSO bridge accepts only site-relative paths; `//`, `\`, and CRLF rejected. Tested |
| SSRF | The media proxy refuses any URL not on the Moodle origin |
| Content sniffing | The media proxy serves only `image/*`, with `nosniff` and a locked-down CSP |
| Headers | Helmet: CSP, HSTS in production, `frame-ancestors: none` |
| Log hygiene | Cookies, auth headers, usernames and passwords redacted at the logger |

`tools/smoke.mjs` asserts the tested rows above against a running server. It
is not a formality — run it after any change to `server/`.

## The file map

```
server/
  index.js            Fastify, security headers, CSRF hook, static, errors
  config.js           env parsing; refuses to boot if misconfigured
  session.js          the sealed-cookie session. Read this one first.
  routes/auth.js      sign in / out / me   ← the security-critical file
  routes/api.js       dashboard, courses, catalog, SSO bridge, media proxy
  data/contract.js    THE data contract + runtime validation
  data/moodle.js      live adapter; absorbs Moodle's quirks
  data/mock.js        the catalogue, in memory, self-flagging as demo
src/
  api.js              the single fetch wrapper; 401 → sign in, offline, timeout
  ui.js               DOM helpers + the loading/empty/error states
  views.js            one function per page, builds real DOM
  app.js              boots the signed-in pages, routes, reveals, meters
  login.js            the sign-in page
  i18n.js             VI ⇄ EN, remembered across pages
  styles.css          design tokens
  app.css             app chrome, states, sign-in screen
tools/
  build.mjs           per-page IIFE build
  build-pages.mjs     writes the page SHELLS (no content)
  smoke.mjs           API + security assertions
  app-shots.mjs       drives the real app in a browser
  gen-secret.mjs      a session key
docs/                 MOODLE-SETUP · DEPLOY · OPERATIONS · HANDOFF · this
```

## Things a future maintainer will want to know

**The pages contain no content.** `tools/build-pages.mjs` writes shells with
an empty `#view`; `src/views.js` fills it from the API. Do not put a course
title in the HTML — it belongs in Moodle.

**`href` is never `"#"`.** The contract rejects it. An activity with no
destination omits `href` entirely and renders as visibly unavailable, so a
learner can tell "not ready yet" from "broken". The prototype this replaced
shipped 87 links to nowhere; that is the regression to guard against.

**Animation must never gate visibility.** `reveals()` in `src/app.js` only
hides content that is genuinely below the fold, and a watchdog reveals
anything still transparent after 2.5s. An earlier version parked everything
at `opacity: 0` waiting for a scroll trigger, and whole sections rendered
blank when the trigger never fired.

**Progress bars are only drawn where completion is actually tracked.** Moodle
reports `null` progress for untracked courses; coercing that to 0 would tell
every learner they had done nothing. The `tracked` flag distinguishes them.

**Initials take the first and last name part**, not the first two. Vietnamese
names are family-name-first, so the last part is the given name people are
actually called by.
