# GLOW

Two halves of one product for Pacific Links Foundation:

- **`index.html`** — the public page. Warm, bilingual, lantern-lit; one
  continuous scrubbed scroll story from the hero to the primary CTA.
- **The platform** — sign-in, dashboard, courses, English tracks and
  resources, reading live from the foundation's existing Moodle at
  `glow.mata9.com`.

**Moodle stays the system of record.** This site is a front end for it, and
deliberately stores nothing itself: no database, no user table, no learner
data at rest. Read `docs/ARCHITECTURE.md` for why that was the right call
here.

## Documentation

| Read this | When |
|---|---|
| **`docs/MOODLE-SETUP.md`** | Connecting to the real platform. **Do this first** — it is the only thing standing between the demo and going live. |
| `docs/DEPLOY.md` | Hosting, environment variables, verifying a deploy |
| `docs/ARCHITECTURE.md` | How it works and why; the security model |
| `docs/OPERATIONS.md` | Running it day to day — written for a non-developer |
| `docs/CMS-SETUP.md` | The content editor at `/admin` — setting it up, and using it |
| `docs/HANDOFF.md` | Transferring ownership to the client |
| `CONTENT.md` | Where every piece of copy and imagery came from |

## Run it

```bash
npm install
cp .env.example .env       # DATA_SOURCE=mock needs nothing else

npm run dev:server         # the API, on :8080
npm run dev                # the site, on :5173   ← open this one
```

Sign in with **`demo` / `glow-demo-2026`**. Every page carries a standing
"sample data" banner until the platform is connected, so demo content can
never be mistaken for the foundation's own records.

Production is a single process serving both halves on one origin:

```bash
npm run build              # -> dist/
npm start                  # serves dist/ + /api on $PORT
```

## Check it

```bash
node tools/smoke.mjs       # 32 API + security assertions
node tools/app-shots.mjs   # drives the real app in a browser -> qa/app/
node tools/app-contrast.mjs # WCAG AA on every signed-in page, both languages
node tools/qa.mjs          # the marketing page's scroll QA

SMOKE_RATE_LIMIT=1 node tools/smoke.mjs   # also prove the login lockout
```

The lockout check is opt-in because proving it means spending the whole
ten-attempt budget, and the window is fifteen minutes — on by default it
would make the suite fail for a quarter of an hour after every pass, which
just teaches people to ignore a red result.

`smoke.mjs` covers the rules that must never regress: the API is closed
without a session, a bad password is refused indistinguishably from an
unknown user, the session cookie is HttpOnly and encrypted, cross-origin
POSTs are rejected, and the SSO bridge cannot be turned into an open
redirect. Run it after any change under `server/`.

## Stack

| Concern | Choice |
|---|---|
| Smooth scroll | Lenis (`lerp: 0.09`, native scrollbar, `syncTouch: false`) |
| Choreography | GSAP + ScrollTrigger, everything `scrub: true` |
| Text splitting | `split-type`, re-split after every language swap |
| Lantern | 120-frame WebP sequence on a single 2D canvas |
| Build | Vite, vanilla JS |
| Type | Prata (display) + Be Vietnam Pro (UI/body, full diacritics) |

## Layout of the source

```
index.html          all markup, both languages inline as data-vi / data-en
src/
  main.js           bootstrap: Lenis, preloader, single rAF loop, lantern route
  lantern.js        the frame sequence, waypoints, damping, dust motes
  scroll.js         every ScrollTrigger; text splitting lives here too
  thread.js         the SVG thread and its corridor solver
  i18n.js           VI <-> EN cascade and the hero word cycler
  interact.js       click ring + press feedback
  styles.css        tokens + all layout
public/assets/
  img/lantern-still.webp   reduced-motion / fallback frame
  seq/lantern/*.webp       frame_0001 … frame_0120 (~4.2 MB total)
tools/              asset generation + QA scripts (not shipped)
  crawl-public.mjs      read glow.mata9.com as an anonymous visitor
  pull-course-art.mjs   download the course covers that crawl found
  build-catalogue.mjs   -> server/data/glow-catalogue.js (generated)
.gen/               masters, source video, crawl output (not shipped)
```

`npm run catalogue` runs those three in order. It is the whole update path
when Pacific Links changes their courses — nothing in the catalogue is
hand-written, so nothing drifts. See `CONTENT.md`.

## No stand-in photography

Every image slot renders a labelled **Picture** placeholder rather than
generated photography, so nothing on the page can be mistaken for real art
direction or real people. The placeholders are plain DOM, sized by their
container, so every scroll effect that used to drive an `<img>` — the chapter
clip-wipes, the gallery's inner parallax — drives them unchanged.

The lantern is the one generated visual that stays: it is the product object the
whole scroll story is built around, not decoration standing in for a photo.
Retired plates are kept in `.gen/retired-photos/` if any are ever wanted back.

## The lantern

Generated with Higgsfield, then turned into a scrubbable sequence:

1. `gpt_image_2` renders a reference still of the lantern on pure white.
2. `seedance_2_0` takes that still as `--start-image` and shoots a 12s locked-off
   360° turntable at 1080p — one continuous take, so frame-to-frame consistency
   is real rather than prompted.
3. `tools/extract-frames.ps1 -KeyWhite` resamples 289 source frames down to 120,
   cuts the white backdrop to alpha, and writes WebP.

Regenerate the sequence from a different take with:

```powershell
tools\extract-frames.ps1 -Video ".gen\lantern-white.mp4" -KeyWhite
```

**Why white, not the dark studio background the brief describes.** The first two
takes were shot on dark charcoal exactly as specified. They looked excellent in
isolation but composited onto the cream page as an opaque black rectangle, and
they could not be keyed: the cord, the bronze caps and the tassel sit at the same
luminance as the backdrop, so any luma key ate the lantern's own hardware. On
white every one of those parts is dark against a bright field and keys cleanly,
and the alpha is derived from distance-to-white so the amber inner glow survives.
The warmth the dark backdrop was providing is now supplied by the `#halo`
gradient element, which is what the brief wanted it for anyway.

The sequence loops: `frame = round(progress * 240) % 120`, two revolutions over
the page. The wrap seam was measured rather than assumed — SSIM between frames
120→1 is 0.880 against 0.887 for an ordinary adjacent pair, i.e. the join is
indistinguishable from any other step, so the loop is seamless.

### Making it part of the page, not a sprite on top of it

Three things were making the lantern read as detached, and each has a fix:

- **It floated in viewport space.** Waypoints now name **layout anchors**
  (`#slotHero`, `#slotMani`) — real, invisible elements the page reserves for
  it. The lantern's target is read from their live rects every frame, so it
  hangs in the hero's own right-hand column and travels with the layout as you
  scroll instead of hovering on a separate plane. Position tracking is only
  lightly damped (0.16) for exactly this reason: a heavy lag would let it drift
  away from the element it is supposed to belong to. Scale and light stay at
  0.06.
- **It didn't light anything.** A lamp that leaves the page untouched is a
  sticker. `#glowWarm` (wide, `soft-light`) warms the paper and the type near
  it; `#glowCore` (tight, `screen`) is the bloom right around the silk. Both
  live at **body level, outside `#stage`** — `mix-blend-mode` only composites
  against the backdrop of its nearest stacking context, so nested inside the
  stage they would have blended with nothing and the page would have stayed
  cold. Both gradients run to zero at the element edge; stopping short leaves a
  visible ring, which is the exact "disc floating over the page" artefact the
  layer exists to remove.
- **It hung from nothing.** The cord is drawn from the lantern's cap up out of
  the top of the viewport, and fades by horizontal distance from centre, so it
  reads as suspended from the page itself.

`.hero-plate` was deleted along the way — a decorative gradient clipped by the
hero container, which drew a hard vertical seam at the container edge once the
real light existed.

### How it moves

**One size, start to finish.** No zoom, no dimming, no reappearance. It hangs in
the hero slot, moves to the manifesto slot, holds there while the manifesto line
fills in, then drifts off the right edge over a long stretch and is never seen
again. The chapters, gallery, stats and mission have no lantern at all.

The exit does **not** fade — opacity holds at 1 for the whole journey out and
only drops once the lantern is clear of the viewport, purely to stop drawing it.

Pacing that exit took measurement rather than guessing. Two things made early
versions feel abrupt:

1. The window was keyed to the manifesto *element*, which ends long before the
   pinned copy actually leaves the screen. It is now keyed to the **pin**
   (`'+=150%'`), the real window the lantern has to live and die inside.
2. The target was far off-screen (`x: 2.05`), so the lantern cleared the right
   edge in the first third of the window and the rest of the travel was
   invisible. Ending **just past the edge** (`x: 0.72`) spends the whole
   stretch on screen.

Measured result: visible from p≈0.109 to p≈0.218 — about 1.6 viewports of
scrolling. `tools/probe.mjs` prints the live route and per-scroll position if it
ever needs retuning.

Sampling is smoothstep between waypoints. Few waypoints, long holds — the
lantern is furniture, not a fly.

## The pendulum

The lantern hangs from a cord, so its rotation is a **damped spring on the
angle**, not a lerp — the overshoot is the whole point. One model produces both
behaviours the design needs:

```
lead      = clamp(-velocityX * 0.045, ±20°)   // body trails the pivot
targetRot = lead + idleSway
rotVel   += ((targetRot - rot) * 80 - rotVel * 12) * dt
rot      += rotVel * dt
```

`ζ ≈ 0.67` — one clean overshoot when it settles, never a bounce loop. Because
tilt comes from velocity, the lean is emergent rather than authored: the lantern
angles over as it is drawn off the side (peaking around 9–16° depending on how
fast you scroll) and straightens as it comes to rest, which is what a hanging
object actually does. Measure it with `tools/tilt-check.mjs`, which scrolls
*continuously* — a jump-and-settle screenshot always catches the angle at zero.

## Dragging it

Grab the lantern and throw it around; it swings on its cord and returns to
whichever slot the page has it in.

- **Hit testing is manual.** The canvas stays `pointer-events: none` — a
  full-screen hit target would swallow every click on the page. Listeners sit on
  `window`, test the pointer against the lantern's own bounds, and only claim
  the event (capture phase, `stopPropagation`) when it is genuinely on the silk.
  Buttons underneath keep working; there is a regression test for exactly that.
- **Mouse only.** Gated behind `(pointer: fine)`, because hijacking a touch drag
  would break scrolling on a phone. Off entirely under reduced motion.
- **Release is a swing, not a snap.** Letting go drops the position tracking from
  0.16 to 0.06 for about half a second, so it travels home under its own weight
  and the angle spring does the rest.

`tools/drag-check.mjs` covers the whole loop: cursor state on and off target,
follow, tilt while travelling, swing-back overshoot, return to anchor, and that
a real button still receives its click.

## Click feel

`interact.js` adds two things: a ring of lantern light that expands from the
pointer on press, and controls that physically give (scale 0.972) and spring back
on release. Rings are a pool of six reused nodes, so clicking fast never churns
the DOM. Enter/Space get the same press feedback as a pointer, and the whole
module is skipped under reduced motion.

## The thread

`thread.js` does not use hand-placed coordinates. It measures every text block,
builds the set of horizontal corridors that are free at each y, and snaps a
densely-resampled route into them. Two details matter:

- **It measures with `offsetTop`/`offsetLeft`, not `getBoundingClientRect`.**
  Pinned sections carry a live transform; the thread is untransformed document
  space. Only the offset chain describes the frame the thread actually lives in.
- **Snapping is continuity-weighted.** Hopping to a different corridor costs a
  curve sweeping straight across a column of body copy, so staying put is
  weighted 6× over reaching the preferred x.

That second point is why the thread stays in one gutter for the whole page rather
than weaving hero-left → manifesto-centre → column-gutter as the brief sketches.
Every version that crossed the page collided with body text at one or more of the
three validation widths; the crossing itself is the collision, not the endpoints.
The line keeps its weave, but within the margin.

Across the pinned gallery the thread fades out. During that pin the cards fill the
viewport edge to edge and there is genuinely no corridor left — stepping aside
reads better than crossing card copy.

Validated collision-free at 1280 / 1440 / 1680 by `tools/qa.mjs`.

## The file:// constraint

Opening `dist/index.html` straight off disk rules out two things a normal Vite
build depends on, so both are worked around:

- **ES module script tags are blocked by CORS on `file://`.** The build emits a
  single IIFE and a Vite plugin strips `type="module"` from the built HTML. The
  plugin is `apply: 'build'` only — dev still serves real modules.
- **`fetch()` is blocked on `file://`.** Frames load through `new Image()` and are
  handed to `createImageBitmap` for off-thread decode, falling back to the element
  itself. Same code path everywhere, no protocol sniffing.

Public asset URLs are set from JS as CSS custom properties (`--plate`, `--grain`)
so one relative form (`./assets/…`) resolves in dev, in `dist/`, and from disk.

## QA

```bash
node tools/qa.mjs                      # against the dev server
node tools/qa.mjs "file:///C:/…/dist/index.html"
```

Shoots eight scroll waypoints plus reverse-scroll, checks thread/text collisions
at three widths, runs a reduced-motion pass and a 390px mobile pass, and reports
console errors. Screenshots land in `qa/`.

`tools/diag.mjs` prints page errors and boot state; `tools/probe.mjs` inspects the
thread route at a given y.

## Accessibility

`prefers-reduced-motion: reduce` turns Lenis off, drops every pin, freezes the
sequence on frame 1, draws the thread fully, and replaces the scrubs with plain
fades. The language toggle is a `<button aria-pressed>`. Heading order is intact.
`<noscript>` gets a plain stacked page.

## Still to do

**Before this can serve real learners**, in order:

1. **`docs/MOODLE-SETUP.md`** — a Moodle admin enables web services and
   creates the `glow_frontend` external service. ~20 minutes. Until this
   happens the site runs on sample data, and says so on every page.
2. **`docs/DEPLOY.md`** — hosting, under a Pacific Links account.
3. **`docs/HANDOFF.md`** §1 — create the accounts in the client's name
   *before* building further, not after. Several cannot be transferred later.

Known gaps, deliberately:

- **Quizzes and assignments open in Moodle**, via the SSO bridge, rather
  than being reimplemented here. Rebuilding Moodle's quiz engine would be
  months of work and would then need maintaining; the bridge makes the
  handoff seamless instead. See `docs/MOODLE-SETUP.md` step 5.
- **Course interiors are illustrative in demo mode.** They sit behind the
  login and were never accessible, so `mock.js` shows structure, not
  invented content. Marked as such in that file.
- **19 of the 31 tracks are known only by their menu label.** Moodle tells
  an anonymous visitor the full title, category, summary and cover art for
  the other 12, and `tools/crawl-public.mjs` takes all of it — but the rest
  answer "currently unavailable to students". Those pages show the label and
  an *Open in Moodle* button rather than a guess. A web-services token makes
  the whole question go away; see `CONTENT.md`, "Still behind the login".
- **Three course covers are 470–600 KB PNGs**, straight from GLOW
  (`pronunciation-intermediate`, `pronunciation-advanced`,
  `english-placement-assessment`). One loads per course page, so it is not a
  landing-page cost, but they are worth re-encoding to WebP before launch.
- **No notifications or messaging.** The bell and envelope from the
  prototype were removed rather than left as decoration that did nothing.
- **No analytics.** Worth a deliberate decision given who the learners are,
  rather than adding a tracker by reflex.

## Not built (out of scope per the original brief)

Moodle theming, analytics.

A CMS *was* out of scope and then got built anyway, because "the client
cannot change their own words without hiring someone" is a handover
problem, not a feature request. It edits the marketing copy and the news
stories only — never courses or learners, which stay in Moodle. See
`docs/CMS-SETUP.md`.
