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
