/* ═══════════════════════════════════════════════════════════
   The scroll system. Everything scrubbed, everything reversible.
   ═══════════════════════════════════════════════════════════ */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import SplitType from 'split-type';

gsap.registerPlugin(ScrollTrigger);

const q  = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => Array.from(r.querySelectorAll(s));

let splits = [];

/* SplitType.revert() restores the HTML captured at split time, so it MUST run
   before new text is written — otherwise it resurrects the old language. */
export function revertText() {
  splits.forEach(s => s.revert());
  splits = [];
}

/* ───────── text splitting (re-runs on language switch) ─────────
   ONLY the manifesto is split, and only into words.

   Headings used to be split to individual characters for a per-letter
   unfold, and body copy into lines for a reading-highlight scrub. Both
   are gone, for two reasons:

   1. Readability. The line scrub held copy at 55% opacity until the
      reader had scrolled it through a band — so the first thing anyone
      saw on landing was faint grey text.
   2. Split text does not survive translation. Chrome's auto-translate
      rewrites the text inside each span independently, so a heading cut
      into letters comes back as scrambled nonsense — "Kỹ năng và kết nối"
      rendering as "Kỹ neatnrice va kunmarketablet noi". Roughly half of
      GLOW's learners will be reading this page in the other language, so
      that failure is aimed squarely at them.

   The manifesto keeps word-splitting: it is one short line, the fill is
   the section's whole point, and words survive translation intact. */
export function splitText() {
  revertText();

  qa('.mani-line').forEach(el => {
    const s = new SplitType(el, { types: 'words', wordClass: 'w' });
    splits.push(s);
  });
}

/* ───────── heading entrance ─────────
   One move, on the whole heading: a short rise and fade, played once.
   It reads as the section arriving rather than as an effect being
   performed, and — unlike the per-letter unfold it replaces — it costs
   one transform on one element instead of a stagger across ~20.

   Body copy is deliberately NOT animated. It is legible the moment it is
   on screen, which is the only job that mattered. */
function textChoreography(reduced) {
  if (reduced) return;

  qa('h2').forEach(el => {
    gsap.fromTo(el,
      { y: 22, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
  });
}

/* ───────── hero ─────────
   There is no picture to reframe any more — the hero is the marquee — so
   the scrub is just the two type rows counter-travelling, plus a short
   parallax on the copy as the section hands off. */
function hero(reduced) {
  const sec = q('.hero');
  if (!sec || reduced) return;

  const copy = q('.hero-copy', sec);
  const cue  = q('.hero-cue', sec);
  const rows = qa('.st-row', sec);
  if (!rows.length) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: sec, start: 'top top', end: 'bottom bottom',
      scrub: true, invalidateOnRefresh: true,
      refreshPriority: 5,   // the first sticky thing in the document
    },
  });

  /* Each row holds the same span twice, so travelling exactly -50% of the
     row lands the second copy where the first began: no seam, no reset. */
  rows.forEach(row => {
    const back = Number(row.dataset.dir) === 1;
    tl.fromTo(row,
      { xPercent: back ? -50 : 0 },
      { xPercent: back ? 0 : -50, ease: 'none', duration: 1 }, 0);
  });

  if (cue) tl.fromTo(cue, { opacity: 0.5 }, { opacity: 0, ease: 'none', duration: 0.12 }, 0);

  /* `y`, not `translate` — the desktop rule centres this box with the CSS
     `translate` property precisely so the two do not collide.
     Opacity is deliberately left alone: the load sequence owns it, and a
     scrubbed `to()` here would capture whatever value the intro happened to
     be at when the timeline first rendered. */
  if (copy) tl.to(copy, { y: -34, ease: 'none', duration: 0.45 }, 0.55);

  /* The copy is otherwise NOT animated here. It is on screen from the first
     frame — an entrance that hides what GLOW is until the visitor scrolls
     would be a bad trade for a foundation nobody arrives already knowing
     about. Its arrival belongs to the load sequence in main.js. */
}

/* ───────── manifesto: word-by-word fill, then hand off ───────── */
function manifesto(reduced) {
  const sec = q('.manifesto');
  if (!sec) return;
  const words = qa('.mani-line .w', sec);
  if (!words.length) return;

  if (reduced) { gsap.set(words, { opacity: 1 }); return; }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: sec, start: 'top top', end: '+=150%',
      pin: true, pinSpacing: true, anticipatePin: 1,
      scrub: true, invalidateOnRefresh: true,
      refreshPriority: 4,        // pinned sections must refresh in document order
    },
  });
  tl.fromTo(words, { opacity: 0.72 }, { opacity: 1, stagger: 0.5, ease: 'none' }, 0);
  tl.to('.mani-inner', { scale: 0.94, opacity: 0.6, ease: 'power1.in' }, 0.72);
  /* No background tween on the section itself. The object sits BEHIND the
     manifesto during the close-up, and an opaque section background paints
     straight over it. The cream -> blush wash is done by .manifesto::before
     instead, which is also what keeps the copy legible over the silk. */
}

/* ───────── what's on GLOW: a plain reveal ─────────
   This section carried the crop-open sequence for a while. The hero opens
   that way now, and running the same trick twice on one page stops reading
   as a decision and starts reading as a habit — so this is one short rise
   on the heading and the picture, and nothing else. */
function showcase(reduced) {
  const sec = q('.showcase');
  if (!sec || reduced) return;

  const items = [q('.showcase-head', sec), q('.showcase-panel', sec)].filter(Boolean);
  if (!items.length) return;

  gsap.fromTo(items,
    { y: 26, opacity: 0 },
    {
      y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: sec, start: 'top 78%', once: true },
    });
}

/* ───────── chapters: shared sticky frame, clip-wipe between shots ───────── */
function chapters(reduced) {
  const sec = q('.chapters');
  if (!sec) return;
  const shots = qa('.shot', sec);
  const odo   = q('.odo-cur b');
  const frame = q('.frame');

  qa('.chap', sec).forEach((chap, i) => {
    // ghost numeral drifts slower than the page
    gsap.to(qa('.ghost-num', chap), {
      yPercent: -18, ease: 'none',
      scrollTrigger: { trigger: chap, scrub: true, start: 'top bottom', end: 'bottom top', invalidateOnRefresh: true },
    });

    if (reduced || !shots.length) return;

    ScrollTrigger.create({
      trigger: chap,
      start: 'top 55%',
      end: 'bottom 55%',
      invalidateOnRefresh: true,
      onToggle: self => {
        if (!self.isActive) return;
        shots.forEach((s, k) => {
          gsap.to(s, {
            clipPath: k <= i ? 'inset(0% 0 0 0)' : 'inset(100% 0 0 0)',
            duration: 0.6, ease: 'expo.inOut', overwrite: 'auto',
          });
          if (k === i) {
            gsap.fromTo(qa('img, .ph', s), { scale: 1.06 }, { scale: 1, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
          }
        });
        if (odo) gsap.to(odo, { y: `${-i * 1.35}em`, duration: 0.5, ease: 'power3.inOut', overwrite: 'auto' });
      },
    });
  });

  // the frame breathes against the scroll
  if (frame && !reduced) {
    gsap.fromTo(frame, { y: 20 }, {
      y: -20, ease: 'none',
      scrollTrigger: { trigger: sec, scrub: true, start: 'top bottom', end: 'bottom top', invalidateOnRefresh: true },
    });
  }
}

/* ───────── gallery: pinned horizontal run with cover-flow ───────── */
function gallery(reduced) {
  const sec   = q('.gallery');
  const track = q('.gal-track');
  const fill  = q('#galFill');
  const cur   = q('#galCur');
  if (!sec || !track || reduced) return;

  const cards = qa('.card', track);
  const shift = () => Math.max(0, track.scrollWidth - window.innerWidth + 40);

  /* On a wide enough monitor all six cards are already on screen and there is
     nothing to travel — the section was pinning for three and a half screens
     of scroll while absolutely nothing moved. Collapse the run to nothing in
     that case and let the section scroll past like any other. A function, so
     `invalidateOnRefresh` re-decides it whenever the window is resized. */
  const runs = () => shift() > 24;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: sec, start: 'top top', end: () => (runs() ? '+=350%' : '+=1'),
      pin: true, pinSpacing: true, anticipatePin: 1,
      scrub: true, invalidateOnRefresh: true,
      refreshPriority: 2,
      onUpdate: self => {
        if (fill) gsap.set(fill, { scaleX: self.progress });
        if (cur) {
          const n = Math.min(cards.length, Math.floor(self.progress * cards.length) + 1);
          cur.textContent = String(n).padStart(2, '0');
        }
      },
    },
  });
  tl.to(track, { x: () => -shift(), ease: 'none' });

  /* Cover-flow: scale + rotateY by distance from viewport centre.

     Only while the row is actually travelling. On a monitor wide enough to
     hold all six cards the track never moves, so this settled into a static
     warp — the outer cards permanently 6% smaller and turned 4 degrees, with
     their artwork nudged off-centre. Nothing about that reads as an effect
     when it isn't moving; it reads as a row that failed to line up. Flat is
     the correct rendering of a row at rest. */
  gsap.set('.gal-viewport', { perspective: 1400 });
  cards.forEach(card => {
    gsap.set(card, { transformStyle: 'preserve-3d' });
    const inner = q('img, .ph', card);
    const tick = () => {
      if (!runs()) {
        gsap.set(card, { scale: 1, rotateY: 0 });
        if (inner) gsap.set(inner, { yPercent: 0 });
        return;
      }
      const r = card.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      const d = (mid - window.innerWidth / 2) / (window.innerWidth / 2);   // -1 .. 1
      const c = Math.max(-1, Math.min(1, d));
      gsap.set(card, { scale: 1 - Math.abs(c) * 0.06, rotateY: -c * 4 });
      if (inner) gsap.set(inner, { yPercent: -c * 4 });
    };
    ScrollTrigger.create({
      trigger: sec, start: 'top bottom', end: '+=450%',
      onUpdate: tick, onRefresh: tick, invalidateOnRefresh: true,
    });
  });
}

/* ───────── stats: counters, velocity-coupled marquee, tilted quotes ───────── */
function stats(reduced, getVelocity) {
  const sec = q('.stats');
  if (!sec) return;

  /* The counters count UP TO the number that is already in the markup — they
     do not put it there. index.html ships the real figures as its text, so
     the page says "5 English tracks" before a line of this file has run and
     goes on saying it if none of it ever does; see the note above .stat-row.

     What changes here is only the order of two things that used to be one:
     the element is knocked back to zero at the moment its animation starts,
     not at authoring time. Nothing outside this function ever sees a zero.

     Reduced motion skips the whole mechanism rather than running it at
     duration 0 — there is nothing to do, because the right number is the
     one already on screen. */
  if (!reduced) qa('.num', sec).forEach(el => {
    const to = Number(el.dataset.to || 0);
    const suf = el.dataset.suffix || '';
    const o = { v: 0 };
    const run = () => {
      o.v = 0;
      el.textContent = '0' + suf;
      gsap.to(o, {
        v: to, duration: 1.7, ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(o.v) + suf; },
      });
    };
    /* Off screen, it is left reading the real number rather than reset to
       zero: a stat that says 0 the moment you scroll past it is wrong even
       when nobody is looking, and a screenshot or a print taken at that
       scroll position would catch it. Re-entering replays from zero. */
    const rest = () => { gsap.killTweensOf(o); el.textContent = to + suf; };
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', end: 'bottom 20%',
      onEnter: run, onEnterBack: run, onLeave: rest, onLeaveBack: rest,
    });
  });

  const quotes = qa('.quote', sec);
  gsap.fromTo(quotes,
    { y: 46, opacity: 0, rotate: (i) => (i % 2 ? 1.5 : -1.5) },
    {
      y: 0, opacity: 1, rotate: (i) => (i % 2 ? 1.5 : -1.5),
      duration: 0.9, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: '.quotes', start: 'top 82%', once: true },
    });
  quotes.forEach(qq => {
    qq.addEventListener('pointerenter', () => gsap.to(qq, { rotate: 0, y: -6, duration: 0.45, ease: 'power3.out' }));
    qq.addEventListener('pointerleave', () => {
      const i = quotes.indexOf(qq);
      gsap.to(qq, { rotate: i % 2 ? 1.5 : -1.5, y: 0, duration: 0.55, ease: 'power3.out' });
    });
  });

  if (reduced) return;

  const rows = qa('.mq-row', sec).map(row => {
    const dir = Number(row.dataset.dir || 1);
    const w = row.scrollWidth / 2;
    gsap.set(row, { x: dir < 0 ? 0 : -w });
    const t = gsap.to(row, {
      x: dir < 0 ? -w : 0, duration: 26, ease: 'none', repeat: -1,
    });
    return t;
  });

  // marquees accelerate with scroll velocity
  ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: 'bottom top',
    onUpdate: () => {
      const boost = 1 + Math.min(6, Math.abs(getVelocity()) / 260);
      rows.forEach(t => t.timeScale(boost));
    },
  });
}

/* ───────── mission: pinned card, page darkens around it ───────── */
function mission(reduced) {
  const sec  = q('.mission');
  const card = q('.mission-card');
  const dark = q('#darken');
  if (!sec || !card) return;

  const btn = q('.btn-magnet', card);
  if (btn) {
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      xTo(Math.max(-12, Math.min(12, (e.clientX - (r.left + r.width / 2)) * 0.35)));
      yTo(Math.max(-12, Math.min(12, (e.clientY - (r.top + r.height / 2)) * 0.35)));
    });
    btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  }

  if (reduced) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: sec, start: 'top top', end: '+=200%',
      pin: true, pinSpacing: true, anticipatePin: 1,
      scrub: true, invalidateOnRefresh: true,
      refreshPriority: 1,
    },
  });
  tl.fromTo(card, { scale: 0.86, borderRadius: '40px' },
                  { scale: 1, borderRadius: '24px', ease: 'none' }, 0);
  if (dark) tl.fromTo(dark, { opacity: 0 }, { opacity: 0.85, ease: 'none' }, 0);
}

/* ───────── header + top progress rail ───────── */
function chrome() {
  const hdr = q('#hdr');

  /* The bar is off screen at the top of the page and slides in once the
     visitor has actually started scrolling. Set from here rather than in the
     stylesheet so that a page with no hero — or no JS — keeps its header
     instead of hiding one it can never bring back. */
  const auto = !!(hdr && q('.hero'));
  if (auto) hdr.classList.add('hdr-auto');

  /* Far enough that a stray wheel notch or a phone's rubber-band does not
     flash the bar, short enough that it is already there by the time anyone
     goes looking for it. */
  const REVEAL = 150;

  const paint = y => {
    if (!hdr) return;
    hdr.classList.toggle('scrolled', y > 40);
    if (auto) hdr.classList.toggle('revealed', y > REVEAL);
  };

  /* start:0 rather than a threshold — the trigger has to stay active all the
     way to the top, or the bar never learns it should leave again. */
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => paint(self.scroll()),
    onRefresh: self => paint(self.scroll()),
  });

  gsap.to('#progress', {
    scaleX: 1, ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.25 },
  });
}

/* ───────── velocity skew ───────── */
function skew(getVelocity, reduced) {
  if (reduced) return;
  const els = qa('[data-skew]');
  if (!els.length) return;
  const setters = els.map(el => gsap.quickSetter(el, 'skewY', 'deg'));
  let cur = 0;
  return () => {
    const target = Math.max(-3, Math.min(3, getVelocity() / -3000));
    cur += (target - cur) * 0.1;
    if (Math.abs(cur) < 0.005) cur = 0;
    setters.forEach(s => s(cur));
  };
}

/* ───────── entry ───────── */
export function initScroll({ reduced, getVelocity }) {
  splitText();
  chrome();
  textChoreography(reduced);
  hero(reduced);
  showcase(reduced);
  stats(reduced, getVelocity);
  mission(reduced);

  const mm = gsap.matchMedia();

  // full choreography on real desktop widths
  mm.add('(min-width: 1024px)', () => {
    manifesto(reduced);
    chapters(reduced);
    gallery(reduced);
  });

  // tablets: keep the story, drop the horizontal pin
  mm.add('(min-width: 768px) and (max-width: 1023.98px)', () => {
    manifesto(reduced);
    chapters(reduced);
  });

  // phones: reveals + the sequence only
  mm.add('(max-width: 767.98px)', () => {
    manifesto(reduced);
  });

  const skewTick = skew(getVelocity, reduced);
  ScrollTrigger.refresh();
  return { skewTick, refresh: () => ScrollTrigger.refresh() };
}

export { ScrollTrigger };
