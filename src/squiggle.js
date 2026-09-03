/* ═══════════════════════════════════════════════════════════
   The scroll-drawn thread. One line, drawn by the scroll and by
   nothing else:

     strokeDashoffset: 1 -> 0 across the whole page

   The path carries pathLength="1", so dash values are already
   normalised: offset 1 is a line that does not exist yet, offset
   0 is the finished line. It starts at 1. Nothing is on screen
   until you scroll, which is the entire idea. (The reuno-ui /
   skiper19 original this began as maps pathLength 0.5 -> 1, so
   it opens already half drawn. That is the one thing about it we
   explicitly do not want.)

   It belongs to the MANIFESTO and to nothing else. Scoped to the
   whole page it had fifteen thousand pixels of scroll to cross,
   which made it crawl — a screen of scrolling moved the tip by
   about seventy pixels, which does not read as movement at all.
   Over one section it draws in roughly three screens, and the
   manifesto is the right section: one line of type on an empty
   field, which is exactly where a drawn line has room to be the
   thing you are looking at. It fades in as the section arrives
   and out as it leaves, so it is not left lying around.

   The layer is FIXED to the viewport, not laid over the document,
   because the manifesto is PINNED: for the whole time it is on
   screen the document keeps scrolling underneath it, so anything
   laid over the document would slide away behind it.

   The path is GENERATED, in real pixels, against a viewBox that
   matches the viewport. Any fixed viewBox has to be scaled to fit
   the screen, and on a 3440-wide monitor that scale is close to
   5:1 horizontally — which lays every descent over on its side
   and leaves a horizontal streak across the middle of the page
   instead of a line going where the reader is going.
   ═══════════════════════════════════════════════════════════ */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const r = n => Math.round(n * 10) / 10;

/* How dark the line gets at full strength. It is behind the copy and behind a
   grain layer, so this is the number that decides whether it reads at all. */
const PEAK = 0.32;

/* A meander down the right of the screen. Every segment descends — no part of
   it doubles back — so the drawn tip travels steadily downward and the line
   reads as one thread being pulled rather than as a shape filling in.
   The sideways swing is capped in pixels: as a share of width it would grow
   without limit on a wide monitor and flatten the whole figure out. */
function meander(w, h) {
  const cx = w * 0.68;                        // right of the copy, clear of it
  const amp = Math.min(w * 0.14, 240);
  const y0 = -0.18 * h;                       // enters from off screen
  const s = (1.36 * h) / 4;                   // and leaves off screen

  const xs = [cx + amp * 0.35, cx - amp, cx + amp, cx - amp, cx + amp * 0.5];

  let d = `M${r(xs[0])} ${r(y0)}`;
  for (let i = 1; i < xs.length; i++) {
    const ay = y0 + s * (i - 1);
    const by = y0 + s * i;
    // vertical tangents at both ends of every segment, so the joins are smooth
    d += `C${r(xs[i - 1])} ${r(ay + s * 0.58)} ${r(xs[i])} ${r(by - s * 0.58)} ${r(xs[i])} ${r(by)}`;
  }
  return d;
}

export function initSquiggle({ reduced }) {
  const svg = document.getElementById('squiggle');
  const path = document.getElementById('squigglePath');
  if (!svg || !path) return;

  const draw = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    path.setAttribute('stroke-width', String(Math.round(Math.min(26, Math.max(14, w * 0.015)))));
    path.setAttribute('d', meander(w, h));
  };

  draw();
  ScrollTrigger.addEventListener('refresh', draw);

  // normalised units: the whole path is length 1
  path.style.strokeDasharray = '1';
  path.style.strokeDashoffset = '1';

  /* Nothing to scope it to, or nothing to animate: leave it hidden. It is
     decorative, and a line that cannot be drawn is better absent than parked
     across the middle of every screen. */
  const sec = document.querySelector('.manifesto');
  if (!sec || reduced) return;

  /* The layer itself does not move; only the line grows. Every curve descends,
     so the tip travels down the screen on its own — drifting the layer as well
     would only fight it. */
  /* The manifesto is PINNED for +150% of the viewport (see manifesto() in
     scroll.js), and a pin adds its length to the scroll without adding it to
     the section's own box — so `bottom` lands in the middle of the pin and the
     line would fade out while the section is still sitting there. The range is
     built from the same two numbers instead: how far ahead of the section it
     starts, plus how long the pin holds. */
  const LEAD = 0.92;   // section is 92% down the viewport when the line starts
  const PIN  = 1.5;    // must match the manifesto's own `end: '+=150%'`

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: sec,
      start: `top ${LEAD * 100}%`,
      end: () => `+=${window.innerHeight * (LEAD + PIN)}`,
      scrub: 0.25,          // short leash: the tip should feel attached to the wheel
      invalidateOnRefresh: true,
    },
  });

  tl.fromTo(svg, { opacity: 0 }, { opacity: PEAK, ease: 'none', duration: 0.12 }, 0);
  tl.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', duration: 0.84 }, 0);
  tl.to(svg, { opacity: 0, ease: 'none', duration: 0.12 }, 0.88);
}
