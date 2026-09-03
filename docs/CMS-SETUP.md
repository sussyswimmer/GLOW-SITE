# The content editor

How Pacific Links staff change the words on the site, and what a developer
has to do once to make that possible.

**If you are staff and just want to edit something**, you only need
"Editing, day to day" below. The rest is setup, done once.

---

## The shape of it

> Someone edits a page at `/admin`. That save becomes a **git commit**.
> Netlify sees the commit and rebuilds the site. Two minutes later it is
> live.

There is no database, no second copy of the content, and no way for the
editor and the site to disagree. The words live in the repository next to
the code:

| In the editor | On disk |
|---|---|
| **Trang chủ / Landing page** | `content/landing.json` |
| **Tin tức / Stories** | `content/stories/*.md`, one file per story |

`tools/content.mjs` reads both at build time and writes the words straight
into the HTML. That is why the site still works with JavaScript switched
off, still opens from a plain file, and still swaps between Vietnamese and
English — as far as the built page is concerned, nothing changed.

The editor is [Decap CMS](https://decapcms.org). Sign-in is Netlify
Identity. Both are served from this site rather than from anyone else's
CDN — see "Upgrading the editor" for why that matters.

---

## What can be edited

### The landing page

Every visible string, in **both languages**, grouped the way the page
reads:

Browser & search · Navigation · Hero · Manifesto line · What's on GLOW ·
The three pillars · Courses heading · The six course cards · Numbers &
quote cards · Mission · Footer

Each field is a Vietnamese box and an English box, side by side. Changing
one language does not touch the other.

### Stories

Announcements, learner stories, events. Create and delete freely. Each has
a Vietnamese title, excerpt and body, an optional English set, a date and
an optional cover image.

**If the English body is left empty, English readers see the Vietnamese
text** rather than a blank page. That is deliberate — a half-translated
story is better than an empty one.

There is one sample story in `content/stories/`. Delete it once the first
real one is published; it says so in its own text.

### What cannot be edited, on purpose

- **The number of things.** Three pillars, six course cards, three stats,
  three quote cards. The page's markup, counters and scroll choreography
  assume those counts, so every list in the config is `allow_add: false`.
  Changing a count is a developer change to `index.html`, not a content
  change.
- **Courses, learners, grades, activities.** Those come from Moodle and
  are edited in Moodle. See `docs/OPERATIONS.md`.
- **Layout, colour, type, animation.** Developer work.

---

## Setting it up on Netlify — once

Do this on the Pacific Links Netlify team, not an individual's. See
`docs/HANDOFF.md` §1.

1. **Site settings → Identity → Enable Identity.**
2. **Registration preferences → Invite only.** Do not leave it open; the
   editor can commit to the repository.
3. **External providers:** leave them off unless the foundation actually
   wants Google sign-in. Fewer doors.
4. **Services → Git Gateway → Enable.** This is the part that turns a save
   into a commit. Without it, staff sign in successfully and then every
   save fails.
5. **Identity → Invite users.** Invite the owner and the deputy from
   `docs/HANDOFF.md` §2 first, and have both accept before anyone else is
   invited.

> **Check this before promising it.** Netlify Identity is a legacy product
> and Netlify has been restricting it to sites that already use it. If
> step 1 offers nothing to enable, Identity is not available here and the
> fallback is Decap's `github` backend, where each editor signs in with
> their own GitHub account instead. That is a change to `backend:` in
> `public/admin/config.yml` and a different invitation story entirely —
> staff would need GitHub accounts and repository access. Find out which
> world you are in **before** telling the foundation how their staff will
> log in.

### The invitation email

Netlify's invite, password-recovery and confirmation emails all link to the
**site root** with a one-time token in the URL, but the thing that consumes
that token lives at `/admin/`. `public/identity-redirect.js`, loaded by
`index.html`, does that one hop and nothing else. For an ordinary visitor
the test fails on an empty URL and nothing happens.

If invitation links ever start landing on the homepage and doing nothing,
that file is what broke.

---

## Editing, day to day

1. Go to **`https://YOUR-SITE/admin/`**.
2. Sign in with the email you were invited on.
3. Pick **Trang chủ / Landing page** to change the words on the front page,
   or **Tin tức / Stories** to write a post.
4. Edit, then **Publish**.
5. Wait one to two minutes, then reload the site. Your change is there.

Things worth knowing:

- **Publish is not instant.** The site rebuilds first. Two minutes is
  normal; if nothing has happened after five, look at the Netlify
  dashboard's Deploys tab — a failed build shows there in red.
- **Nothing is ever lost.** Every save is a commit, so a developer can
  recover any previous version of any text.
- **Write both languages.** A learner switching to English should not fall
  back into Vietnamese unless you chose that.
- **Images** you upload land in `public/assets/img/uploads/`. Landscape,
  roughly 5:2, works best for story covers.

---

## Editing locally, with no Netlify at all

Useful for a developer testing content changes, and for showing staff how
the editor works without giving anyone live access.

```bash
npm run cms    # in one terminal — the file-system proxy, port 8081
npm run dev    # in another — the site, port 5173
```

Then open **http://localhost:5173/admin/**. There is no sign-in: click
**Login** and you are in. `local_backend: true` in `config.yml` sends every
save straight to the working tree as an ordinary file change — no Netlify,
no git, no account. `git diff` shows exactly what the editor wrote.

Decap only looks for that proxy when the page is on `localhost`, so the
setting is inert on the live site.

If `npm run cms` fails with `EADDRINUSE`, something else holds port 8081.
8081 is what the client expects; moving it means changing `local_backend`
in `config.yml` too.

---

## Upgrading the editor

Both scripts under `public/admin/` are **self-hosted copies** of npm
packages, committed to the repository:

| File | Copied from | Version pinned in |
|---|---|---|
| `decap-cms.js` | `node_modules/decap-cms/dist/` | `package.json` |
| `netlify-identity-widget.js` | `node_modules/netlify-identity-widget/build/` | `package.json` |

They are copies rather than CDN `<script>` tags because the site's
Content-Security-Policy allows scripts from `'self'` only, and an admin
page that can commit to the repository is the last place to start trusting
someone else's CDN. Keep it that way.

To upgrade:

```powershell
npm update decap-cms netlify-identity-widget
Copy-Item node_modules/decap-cms/dist/decap-cms.js public/admin/
Copy-Item node_modules/netlify-identity-widget/build/netlify-identity-widget.js public/admin/
```

Then commit both files, and **open `/admin/` and actually save something**
before considering the upgrade done. Nothing checks that these two copies
still match the versions in `package.json`; if they drift, they drift
silently.

### The one known gap

`decap-cms.js` is a webpack entry that can lazily fetch sibling chunks —
92 of them ship in `node_modules/decap-cms/dist/*.decap-cms.js`, and they
are **not** copied here. They are CodeMirror syntax-highlighting modes for
code blocks: `clojure`, `dart`, `css` and so on.

Clicking through the editor — signing in, opening a story, using every
toolbar button, inserting a code block, switching between Rich Text and
Markdown — requests none of them. The only way to reach one is to insert a
code block in a story *and pick a programming language for it*, which would
then fail to highlight. For a foundation publishing bilingual news posts,
that is a fair price for keeping 800 KB across 92 files out of the
repository.

If someone ever does need it, copy
`node_modules/decap-cms/dist/*.decap-cms.js` into `public/admin/` alongside
the entry and it resolves itself — the bundle works out its own base URL at
runtime.

---

## When it goes wrong

| What you see | What it usually is |
|---|---|
| Sign-in works, **saving fails** | Git Gateway is not enabled. Netlify → Site settings → Identity → Services. |
| Nothing to enable under Identity | Identity is not available for this site — see the warning above. |
| An invite link lands on the homepage and does nothing | `public/identity-redirect.js` is missing from the build, or `index.html` no longer loads it. |
| Published, but the site is unchanged after five minutes | Netlify → Deploys. A red build is a build error, not a content error — get a developer. |
| The build failed right after a content edit | Most likely a required field was emptied. `injectTokens()` in `tools/content.mjs` fails the build on a missing value **on purpose**, rather than printing `{{hero.lead.vi}}` onto the live page. |
| `/admin/` is blank | The two scripts did not load. Check the browser console; a CSP error there means someone changed `script-src` in `netlify.toml` or `server/app.js`. |

The editor is `noindex`, and `frame-ancestors 'none'` means it cannot be
put in an iframe. Neither is a substitute for invite-only registration.

---

## Before calling this handed over

- [ ] Identity is **invite only**, and Git Gateway is on
- [ ] The owner and the deputy have both signed in and **published a real
      change**, on their own machines
- [ ] They have watched a change take two minutes to appear, so the delay
      is not alarming the first time it matters
- [ ] They know content is edited here and **courses are edited in
      Moodle**, and can say which is which
- [ ] The sample story has been deleted
- [ ] Both know that a failed deploy shows in the Netlify Deploys tab, and
      who to call about one
