/* ═══════════════════════════════════════════════════════════
   GLOW — bootstrap.
   One Lenis. One rAF. One canvas. Everything hangs off here.
   ═══════════════════════════════════════════════════════════ */

import gsap from 'gsap';
import Lenis from 'lenis';
import { initSquiggle } from './squiggle.js';
import { initI18n } from './i18n.js';
import { initInteractions } from './interact.js';
import { initScroll, splitText, revertText, ScrollTrigger } from './scroll.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── a reload starts at the top ──
   Browsers restore the previous scroll position on reload, which drops you
   into the middle of a page whose entire opening is a sequence — and lands
   you on a thread that is already half drawn, a preloader that has nothing
   left to introduce, and pinned sections mid-scrub. Turned off before the
   restore would happen; an explicit scroll covers a browser that ignores it.

   A deep link is left alone: arriving at index.html#mission is someone asking
   for that section, not a reload.

   It has to go through ScrollTrigger, not `history` directly. ScrollTrigger
   reads `history.scrollRestoration` once when it initialises — which, because
   imports evaluate before this module's body, is BEFORE anything here runs —
   and then writes its captured copy back on every refresh. Setting the
   property by hand is quietly undone on the first refresh; this sets both. */
if (!window.location.hash) {
  ScrollTrigger.clearScrollMemory('manual');
  window.scrollTo(0, 0);
}

document.documentElement.classList.add('js-anim');

/* No stand-in photography anywhere on the page. Grain is the CSS dot field
   drawn by body::after. */

/* ── smooth scroll ─────────────────────────────────────── */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: false,          // native momentum on touch
    wheelMultiplier: 1,
  });
  lenis.on('scroll', ScrollTrigger.update);
}
const getVelocity = () => (lenis ? lenis.velocity * 100 : 0);

/* ── preloader ─────────────────────────────────────────── */
const pre     = document.getElementById('preloader');
const preNum  = document.getElementById('preNum');
const preFill = document.getElementById('preFill');
const curtain = document.querySelector('.curtain');

let shown = 0;
let loadFrac = 0;
const t0 = performance.now();

function paintCounter() {
  // never sit behind the preloader longer than 2.5s, whatever the network does
  const timeFrac = Math.min(1, (performance.now() - t0) / 2500);
  const target = Math.max(loadFrac, timeFrac);
  shown += (target - shown) * 0.12;
  const n = Math.round(Math.min(100, shown * 100));
  if (preNum) preNum.textContent = String(n).padStart(3, '0');
  if (preFill) preFill.style.right = `${100 - n}%`;
  return n;
}

/* Once per browser session, not once per page view. The counter and curtain
   take about two and a half seconds before the headline is readable, which is
   a fair price for an entrance the first time and a toll every time after —
   and this is a site learners come back to. `sessionStorage`, not `local`, so
   the entrance returns on a genuinely new visit rather than being spent once
   and never seen again. */
const SEEN = 'glow_intro_seen';
let introSeen = false;
try { introSeen = sessionStorage.getItem(SEEN) === '1'; } catch { /* private mode */ }

/* ── the hero's arrival ────────────────────────────────── */
function playIntro() {
  try { sessionStorage.setItem(SEEN, '1'); } catch { /* private mode */ }

  if (reduced || introSeen) {
    pre?.classList.add('gone');
    curtain?.classList.add('done');
    /* The copy is held at opacity 0 by `.js-anim .hero-copy` precisely so the
       load timeline can bring it in — skip the timeline without this and the
       hero is a blank navy screen. Reduced motion gets there through its own
       media query; this is the path that does not. */
    gsap.set('.hero-copy', { opacity: 1 });
    gsap.set('.display .ln i', { yPercent: 0 });
    gsap.set('.hero-cue', { opacity: 0.5 });
    return;
  }

  const tl = gsap.timeline();

  tl.to('#preloader', { opacity: 0, duration: 0.35, ease: 'power2.inOut',
                        onComplete: () => pre?.classList.add('gone') });

  // two panels wipe up, 60ms apart
  tl.to('.curtain i', {
    scaleY: 0, duration: 1.0, ease: 'power4.inOut',
    stagger: 0.06, transformOrigin: 'top',
    onComplete: () => curtain?.classList.add('done'),
  }, 0.05);

  /* The type field surfaces, then the copy arrives over it. The scroll
     sequence owns the marquee's travel; its arrival belongs here, because
     both it and the copy have to be there before anyone has scrolled
     anything — the hero has no picture to fall back on. */
  tl.fromTo('.hero-type',
    { opacity: 0 },
    { opacity: 1, duration: 1.4, ease: 'power2.out' },
    0.2);

  tl.fromTo('.hero-copy', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.45);

  // headline lines rise out of their masks
  tl.fromTo('.display .ln i',
    { yPercent: 110 },
    { yPercent: 0, duration: 1.05, ease: 'power4.out', stagger: 0.08 },
    0.5);

  tl.fromTo('.hero-cue',
    { opacity: 0 }, { opacity: 0.5, duration: 0.6 }, 1.25);

  return tl;
}

/* ── the single rAF loop ───────────────────────────────── */
let scrollCtl = null;
let last = performance.now();
let ready = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (lenis) lenis.raf(now);

  if (!ready) {
    const n = paintCounter();
    if (n >= 100 && loadFrac >= 1) start();
  }

  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

  scrollCtl?.skewTick?.();

  requestAnimationFrame(frame);
}

/* ── go ────────────────────────────────────────────────── */
function start() {
  if (ready) return;
  ready = true;
  playIntro();
}

async function boot() {
  // scroll system first so layout is settled before anything measures it
  scrollCtl = initScroll({ reduced, getVelocity });
  initSquiggle({ reduced });

  initInteractions({ reduced });

  initI18n({
    reduced,
    onBeforeSwap: revertText,
    onSwapped: () => {
      splitText();
      ScrollTrigger.refresh();
    },
  });

  requestAnimationFrame(frame);

  // hard ceiling on the preloader, whatever the network is doing
  setTimeout(() => { loadFrac = 1; start(); }, 2500);

  loadFrac = 1;

  /* Nothing to introduce on a repeat visit, so do not wait for the counter to
     ease its way up to 100 first — that is another second on top of the
     entrance we are already skipping. */
  if (introSeen) start();

  /* Webfonts reflow every measured block, which shifts every pinned trigger.
     Re-measure once things have actually stopped moving. */
  try { await document.fonts.ready; } catch { /* no Font Loading API */ }
  const settle = () => ScrollTrigger.refresh();
  settle();
  setTimeout(settle, 700);
}


/* ── resize / refresh ──────────────────────────────────── */
let rt = null;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => ScrollTrigger.refresh(), 180);
});

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot);
