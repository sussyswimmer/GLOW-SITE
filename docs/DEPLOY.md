# Deploying GLOW

One Node process serves the whole site: the built pages and `/api` on the
same origin. There is no database and no second service, so "deploying" is
running one command on one box.

```
npm ci          # exact dependency versions from the lockfile
npm run build   # -> dist/
npm start       # serves dist/ + /api on $PORT
```

---

## Requirements

- **Node 20.11 or newer** (developed and tested on 24)
- **HTTPS**, terminated by the host. Non-negotiable: learners' passwords are
  forwarded over it, and the session cookie is marked `Secure` in production
  and so will simply not be sent over plain HTTP.
- No database. No Redis. No object storage.

## Environment

Set in the host's secret/environment store — **never** in a file in the
repository. `.env.example` documents every variable.

| Variable | Required | Value |
|---|---|---|
| `SESSION_SECRET` | **yes** | `npm run secret` → 32 bytes base64 |
| `PUBLIC_ORIGIN` | **yes** | `https://glow.example.org` — the site's own URL |
| `NODE_ENV` | **yes** | `production` |
| `DATA_SOURCE` | **yes** | `moodle` once `docs/MOODLE-SETUP.md` is done |
| `MOODLE_URL` | with `moodle` | `https://glow.mata9.com`, no trailing slash |
| `MOODLE_SERVICE` | with `moodle` | `glow_frontend` |
| `PORT` | usually set by host | defaults to 8080 |
| `LOGIN_MAX_ATTEMPTS` | no | default 10 per 15 min per IP |

The server **refuses to start** if a required value is missing or malformed,
and prints exactly what is wrong. That is deliberate: an auth server that
boots misconfigured and accepts everyone is worse than one that will not
boot. Read the message; it names the variable.

## Choosing a host

The site is an ordinary Node web service, so almost anything works. Ranked
for a small foundation with no platform team:

| | Cost | Ownership transfer | Notes |
|---|---|---|---|
| **Render** ⭐ | free tier, ~$7/mo always-on | Clean — supports team ownership | Deploys from GitHub, HTTPS automatic, readable logs. Recommended. |
| **Railway** | ~$5/mo | Good | Similar, slightly more configuration |
| **Fly.io** | ~$3/mo | Good | Cheapest, but needs a Dockerfile and CLI comfort |
| **A VPS** | ~$5/mo | Total | You own the OS patching too. Only if somebody there genuinely administers Linux. |

> On a free tier the service sleeps when idle and the first visit after that
> takes 30–60 seconds. Acceptable for review; not acceptable for learners.
> Budget the paid tier before launch.

**Whichever you pick, create the account as Pacific Links, not as yourself.**
See `docs/HANDOFF.md` §1 — this is the step that is painful to undo.

## Deploying on Render

1. Push the repository to the Pacific Links GitHub organisation.
2. Render → **New → Web Service** → connect that repository.
3. Settings:
   - Runtime: **Node**
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`
   - Health check path: `/api/health`
4. Add the environment variables from the table above.
5. Deploy, then point the domain at it and let Render issue the certificate.

Auto-deploy on push to `main` is fine and convenient. If you would rather a
human decided when learners get new code, turn it off and deploy manually.

## The Netlify preview

There is a **second, live deployment** — a review link, not the production
plan above:

> **https://glow-pacific-links.netlify.app** — `demo` / `glow-demo-2026` (more accounts under "Demo accounts" below)

It exists so the site can be shown to people before there is a Pacific Links
host account. It is not where this should live. Two reasons, both worth
acting on before launch:

1. **It is on an individual's Netlify team**, which `HANDOFF.md` §1 is
   explicit about avoiding. Recreate under the foundation's account.
2. **The login lockout is weaker.** `@fastify/rate-limit` counts in memory and
   each warm function instance has its own, so ten-attempts-per-fifteen-minutes
   is per instance rather than global. On Render's single process it is exact.

Everything else is the same app. `netlify/functions/api.mjs` is an adapter,
not a second server: it calls the same `buildApp()` with `serveStatic: false`
and hands it one request at a time, because on that host the CDN is already
serving `dist/`. This only works at all because sessions are stateless
encrypted cookies with no store behind them — a server that kept sessions in
memory could not be run this way.

```bash
npm run deploy:share   # landing page only, no API   -> dist-share/
npx netlify deploy --prod --dir dist --functions netlify/functions   # whole site
```

Two things in `netlify.toml` are **copies** and have to move when their
originals do:

- the `Content-Security-Policy` header block duplicates helmet's policy in
  `server/app.js`. Pages come off the CDN and never touch the app, so helmet
  never sees them. Add a script host in one place, add it in both.
- `pretty_urls = false` is load-bearing. Netlify's default rewrites
  `dashboard.html` to `/dashboard`, and the front end routes on the filename —
  with it on, the dashboard rendered empty and skipped the sign-in redirect.

Environment variables are set in Netlify rather than a file, same as any other
host: `SESSION_SECRET`, `PUBLIC_ORIGIN`, `NODE_ENV=production`, `DATA_SOURCE`.

## The Moodle front page

`glowtest.mata9.com` (and later `glow.mata9.com`) shows this landing page as
Moodle's own home page. **Site administration → Appearance → Additional
HTML → Before BODY is closed** holds exactly one line:

```html
<script src="https://glow-pacific-links.netlify.app/embed/moodle.js"></script>
```

That is the whole integration, and it never needs editing again.
`moodle.js` (source: `src/moodle-embed.js`) runs on Moodle's home page only.
On every visit it fetches the landing markup, CSS and JS that are live on
this site and swaps them in, so a deploy or a CMS edit is on Moodle's home
page the next time anyone opens it. Links are rewritten for Moodle by the
`EMBED_LINKS` table in `tools/build.mjs`: sign-in, "Start learning" and the
course cards go to Moodle itself, everything else comes from this site. The
landing page follows Moodle's language (English Moodle, English page).

It fails safe. If anything is missing, slow (10 s) or down, visitors get
Moodle's ordinary home page, never a half-styled one, and the browser
console says why (`[GLOW] landing page not loaded…`). Admins can add
`?glow=off` to the URL to see and edit Moodle's real home page.

**Never paste the landing markup into Moodle, and never link
`/assets/style.<hash>.css` or `/assets/index.<hash>.js`.** That is what the
setup used to be: the hashed names change on every deploy and the old files
are deleted, so each merge to `main` left Moodle's home page unstyled for
every visitor without the old files cached (it looked fine in the browser
that set it up, broken in incognito), and the pasted copy never picked up
copy changes. `netlify.toml` serves `/embed/*` no-cache with CORS open, and
opens CORS on `/assets/*` because browsers block a cross-origin font without
it.

`/embed/` only works once it is deployed: point Moodle at it after the
change that adds it is live, or the home page shows plain Moodle until then.

## Verifying a deploy

```bash
curl https://YOUR-SITE/api/health
# {"ok":true,"mode":"moodle","demo":false}

node tools/smoke.mjs https://YOUR-SITE
# 30 passed, 0 failed
```

`tools/smoke.mjs` is safe to run against production: it only reads, and it
signs in only in demo mode. It checks the things that must never regress —
that the API is closed without a session, that a bad password is refused,
that the cookie is HttpOnly, that cross-origin POSTs are rejected, and that
the SSO bridge cannot be turned into an open redirect.

Then, by hand:
- Sign in as a **real learner**, not an admin
- Confirm no "sample data" banner
- Open a course, open an activity
- Sign out, then visit `/dashboard.html` — you should land on sign-in

## Rolling back

Redeploy the previous commit from the host's dashboard. There is no database
migration to undo and no state to reconcile, so rollback is always safe and
always instant. This is the main practical dividend of the site being
stateless.

## The one thing that is different from the old build

`index.html` still opens straight from disk, as it always did.

The signed-in pages no longer can, and that is the point rather than a
regression: they fetch `/api`, `fetch` is blocked on `file://`, and there is
nothing to fetch without a server holding the session. They are served by
`npm start` like any other web application.

## Local development

Two processes, one origin — Vite proxies `/api` to the API so the session
cookie is same-site in development exactly as it is in production:

```bash
cp .env.example .env      # DATA_SOURCE=mock needs nothing else
npm run dev:server        # API on 8080
npm run dev               # site on 5173  ← open this one
```

Sign in with `demo` / `glow-demo-2026`.

### Demo accounts

`DATA_SOURCE=mock` serves one account per role, so every role-gated view can
be reviewed. The role always comes from the server, never the browser.

| username | password | name | ID number | role |
|---|---|---|---|---|
| `demo` | `glow-demo-2026` | Lê Thị A | QT20P0007 | learner |
| `demo-gems` | `glow-demo-2026` | Nguyễn Văn B | HU21G0012 | GEMS scholar |
| `demo-seeds` | `glow-demo-2026` | Trần Thị C | QT24S0031 | SEEDS scholar |
| `demo-staff` | `glow-staff-2026` | Phạm Minh D | none | Pacific Links staff |

The sign-in page hint lists only the first three. **The staff login is
documented here only, and it is not a secret**: this repository is public, so
anyone can read the password. That is acceptable because the mock adapter
holds no real data. Real staff gating comes from Moodle once the team says
how staff, GEMS and SEEDS are marked there (see "Roles and the catalogue" in
`ARCHITECTURE.md`); on the live adapter everyone is a learner until then, and
role-gated courses stay hidden.

To develop against the real platform, set `DATA_SOURCE=moodle` and
`MOODLE_URL` in `.env` and sign in with a real account. Be aware you are
then reading production learner data on your laptop — prefer `mock` unless
you specifically need live data.
