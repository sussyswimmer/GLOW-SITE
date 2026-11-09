# Running GLOW

For whoever at Pacific Links looks after the site. **You do not need to be a
developer to use this document.**

---

## First, the reassuring part

**Moodle is where everything lives.** The new site is a nicer way to look at
Moodle. So:

- To add a course, enrol a learner, edit a quiz, change a grade, or reset
  someone's password — **do it in Moodle**, exactly as you do today. The
  site follows automatically. Nobody needs to touch it.
- **If the new site goes down, Moodle is unaffected.** Learners can keep
  working at `glow.mata9.com`. It is inconvenient, not an emergency.

The site holds no learner information of its own. There is no database here
to lose.

---

## Everyday questions

### Someone can't sign in

1. Can they sign in at `glow.mata9.com` directly? If **no**, it is a Moodle
   account problem — reset their password there as usual.
2. If yes, have they tried several times in a row? Sign-in is limited to 10
   attempts per 15 minutes from one internet connection. If a whole class
   shares one connection, they can hit it between them. It clears itself
   after 15 minutes.
3. Still stuck: check `https://YOUR-SITE/api/health` (below).

### A course isn't showing up

Check in Moodle that the learner is actually enrolled, and that the course is
visible rather than hidden. The site shows exactly what Moodle says.

### An activity says "not available yet"

That is the site telling the truth: Moodle has no link for it. Usually the
activity is hidden, restricted, or has no content added yet. Fix it in
Moodle and it appears.

### Progress looks wrong or shows no bar

The site shows Moodle's own completion figure. No bar at all means
completion tracking is switched off for that course — turn it on in the
course settings if you want progress there.

### Someone sees "Sample data — not connected to the live platform yet"

The site is in demo mode. It is showing example content, **not** your
learners. Fix: set `DATA_SOURCE=moodle` in the hosting dashboard and
redeploy. See `docs/MOODLE-SETUP.md`.

### I want to change the words on the front page, or post news

You can do that yourself, without a developer. Go to
**`https://YOUR-SITE/admin/`** and sign in with the email you were invited
on. You get two things to edit:

- **Trang chủ / Landing page** — every piece of text on the front page, in
  Vietnamese and English side by side.
- **Tin tức / Stories** — announcements, learner stories, events. Write as
  many as you like.

Press **Publish**, then wait one to two minutes and reload the site.
Publishing is not instant, because the site rebuilds itself first.

Two boundaries worth holding in your head:

- **Words on the marketing pages** → edit them here.
- **Courses, learners, grades, activities** → edit them in **Moodle**, as
  you do today. Nothing about those is in the editor, on purpose.

You cannot add a fourth pillar or a seventh course card here. Those counts
are built into the page's design. Ask a developer.

Full instructions, including what to do when a publish does not appear, are
in `docs/CMS-SETUP.md`.

---

## Is it up?

Open in a browser, or run:

```
https://YOUR-SITE/api/health
```

| Response | Meaning |
|---|---|
| `{"ok":true,"mode":"moodle","demo":false}` | Healthy and live. |
| `{"ok":true,"mode":"mock","demo":true}` | Running, but on sample data. |
| Nothing / an error page | The site is down. See below. |

## The site is down

1. Open the hosting dashboard. Is the service running or stopped?
2. Read the most recent logs. The server prints a clear reason when it
   refuses to start — usually a missing or malformed setting, named
   explicitly.
3. If a deploy just happened, **roll back to the previous version** from the
   dashboard. This is always safe: there is no database and no migration to
   undo.
4. Tell learners to use `glow.mata9.com` in the meantime. Everything still
   works there.

## Emergency: switch sign-in off

If you suspect accounts are being attacked or a secret has leaked:

1. Set `AUTH_ENABLED=false` and redeploy. Sign-in stops; the public page
   stays up.
2. Change `SESSION_SECRET` to a new value (see below). Everyone signed in is
   signed out immediately.
3. If Moodle itself may be affected, that is the more urgent problem —
   handle it there first.

## Rotating the session key

Do this if the key may have leaked, and once a year regardless.

1. Generate a new value — `npm run secret`, or ask your developer.
2. Replace `SESSION_SECRET` in the hosting dashboard.
3. Redeploy.

Every learner is signed out and signs in again. Nothing is lost. Practise
this once while your developer is still available, so the first time is not
during an incident.

---

## EMMAI (the AI advisor) and Lesson Studio drafting

Both are **off until an API key is added**, and nothing else on the site
depends on them. Learners then see "EMMAI is switching on soon", and Lesson
Studio says drafting switches on when the key is added.

**To switch them on:** in the host's secret store (Netlify: Site
configuration, Environment variables) set `ANTHROPIC_API_KEY` to a key from
the Anthropic Console, then redeploy. Never put the key in a file in git.

**Choosing the model (cost).** `EMMAI_MODEL` defaults to `claude-opus-5-5`
(about $4 in / $20 out per million tokens). `claude-haiku-5-5` is much
cheaper (about $0.10 / $0.50 per million) and fine for short course advice;
the lesson drafter benefits more from the larger model. One variable
covers both, so this is the owner's call. Each EMMAI reply is a few
thousand input tokens (the course list, which is cached) and about 150
words out.

**What it does with data.** Message text is sent to Anthropic to get a
reply and is never written to our logs. Learners are told not to share
passwords or personal details. EMMAI only recommends courses the signed-in
person is allowed to see (staff-only courses are never in a learner's
prompt).

**Limits.** 20 messages a minute and 6 lesson drafts a minute per IP.
Replies are short on purpose: the Netlify function cannot stream, and its
synchronous time limit is 60 seconds in current Netlify docs but 10 seconds
in older forum answers. The server gives the AI service 25 seconds for
EMMAI and 55 seconds for a lesson draft, and never retries (a retry would
be billed twice and could overrun the function limit). If your plan really
is 10 seconds, EMMAI will show its "try again" message under load and
lesson drafting will time out; check the limit on your Netlify plan. The
browser waits 30 s (EMMAI) and 60 s (draft).

**Spend exposure.** The demo login is public and production runs the mock
data source, so once `ANTHROPIC_API_KEY` is set anyone who signs in with
the demo account can use EMMAI on the foundation's bill (20 messages a
minute per IP is the only brake). Before setting the key, set a monthly
spend limit in the Anthropic Console, or keep the key unset until the site
runs on live Moodle (real sign-in only).

**If a safety filter declines a request,** the API automatically retries on
a fallback model (the `server-side-fallback` beta). It is on by default.

---

## Regular maintenance

| How often | What |
|---|---|
| **After every Moodle upgrade** | Sign in and check a course loads. Moodle upgrades occasionally change the API this site reads. |
| Monthly | Open the site and sign in as a real learner. Two minutes. |
| Every few months | Have a developer update dependencies. **A site nobody touches is not stable, it is unpatched.** |
| Yearly | Rotate `SESSION_SECRET`. Re-check who has access to the accounts in `docs/HANDOFF.md` §1–2. |
| When someone leaves | Remove their access everywhere; rotate anything they knew. |

## What to tell a developer

If you need to hire someone to work on this, they need to know:

- Plain JavaScript. Node + Fastify on the server, Vite + vanilla JS in the
  browser. No framework to learn.
- No database. Moodle is the system of record, reached over its web-services
  API.
- Start with `docs/ARCHITECTURE.md`, then `server/session.js`.
- Before shipping: `npm run build`, then `node tools/smoke.mjs` against a
  running server — 30 checks covering the security rules that must not
  regress.

## Who to contact

```
Site owner:        ______________________
Deputy:            ______________________
Moodle admin:      ______________________
Hosting account:   ______________________
Developer:         ______________________
Support ends:      ____________
```
