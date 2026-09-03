/* ═══════════════════════════════════════════════════════════
   Click feel. Two small things that read as "expensive":
   a ring of refracted light where you pressed, and controls that
   physically give under the finger and spring back.
   ═══════════════════════════════════════════════════════════ */

import gsap from 'gsap';

const PRESSABLE = 'button, a, .card, .quote';
const POOL = 6;

export function initInteractions({ reduced }) {
  if (reduced) return;

  /* ── the ring ────────────────────────────────────────── */
  const layer = document.createElement('div');
  layer.className = 'tap-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const rings = Array.from({ length: POOL }, () => {
    const r = document.createElement('span');
    r.className = 'tap-ring';
    layer.appendChild(r);
    return r;
  });
  let next = 0;

  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const ring = rings[next];
    next = (next + 1) % POOL;

    gsap.killTweensOf(ring);
    gsap.set(ring, { x: e.clientX, y: e.clientY, scale: 0.25, opacity: 0.55 });
    gsap.to(ring, {
      scale: 1, opacity: 0, duration: 0.62, ease: 'power2.out',
      overwrite: true,
    });
  }, { passive: true });

  /* ── press feedback ──────────────────────────────────── */
  const down = new WeakMap();

  const press = (el, on) => {
    // .btn-magnet is already being driven on x/y — only ever touch scale here
    gsap.to(el, {
      scale: on ? 0.972 : 1,
      duration: on ? 0.16 : 0.55,
      ease: on ? 'power2.out' : 'elastic.out(1, 0.55)',
      overwrite: 'auto',
    });
  };

  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.(PRESSABLE);
    if (!el || e.button !== 0) return;
    down.set(el, true);
    press(el, true);
  }, { passive: true });

  const release = e => {
    const el = e.target?.closest?.(PRESSABLE);
    if (el && down.get(el)) { down.delete(el); press(el, false); }
  };
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('pointerleave', release, { passive: true });

  /* keyboard parity: Enter/Space should feel the same as a click */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement?.closest?.(PRESSABLE);
    if (el && !down.get(el)) { down.set(el, true); press(el, true); }
  });
  document.addEventListener('keyup', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement?.closest?.(PRESSABLE);
    if (el && down.get(el)) { down.delete(el); press(el, false); }
  });
}
