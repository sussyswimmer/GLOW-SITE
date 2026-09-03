/* ═══════════════════════════════════════════════════════════
   VI ⇄ EN — the language switch is a feature, not a utility.
   Every [data-i18n] rolls over in a stagger cascade; text is
   re-split AFTER the swap so char animations stay correct.
   ═══════════════════════════════════════════════════════════ */

import gsap from 'gsap';

const CYCLE = {
  vi: ['cơ hội', 'kỹ năng', 'tương lai', 'tự tin'],
  en: ['opportunities', 'skills', 'futures', 'confidence'],
};

/* The chosen language is remembered. On a one-page site that hardly
   mattered; across five signed-in pages, resetting to Vietnamese on
   every navigation means an English-reading learner re-toggles on every
   click, which is the kind of small friction that reads as brokenness. */
const STORE_KEY = 'glow.lang';

function remembered() {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v === 'en' || v === 'vi' ? v : null;
  } catch {
    return null;   // private mode, or storage disabled — fall back to the default
  }
}

/* ── the page's own metadata ──────────────────────────────
   <title>, the meta description and <html lang> are content too, and they
   were the one part of the page the toggle never touched: a Vietnamese
   interface sat under "My courses | GLOW" in a document declaring itself
   Vietnamese while describing itself in English. Search results, browser
   tabs, shared links and every screen reader's language model read those
   three and nothing else, so they swap with everything else now.

   The strings live on <html> as data-title-vi / data-title-en /
   data-desc-vi / data-desc-en, written by tools/build-pages.mjs and by hand
   on index.html. A page with none of them is left alone. */
export function applyDocMeta(lang) {
  const root = document.documentElement;
  root.lang = lang;

  const title = lang === 'en' ? root.dataset.titleEn : root.dataset.titleVi;
  if (title) document.title = title;

  const desc = lang === 'en' ? root.dataset.descEn : root.dataset.descVi;
  const meta = document.querySelector('meta[name="description"]');
  if (desc && meta) meta.setAttribute('content', desc);
}

/* Used by the views for a page whose title is not known until its data
   arrives — the course page. Writing it back onto <html> rather than
   straight to document.title is what stops the next language toggle from
   overwriting the course name with the shell's generic heading. */
export function setDocTitle(vi, en) {
  const root = document.documentElement;
  root.dataset.titleVi = vi;
  root.dataset.titleEn = en;
  applyDocMeta(root.lang === 'en' ? 'en' : 'vi');
}

export function initI18n({ onSwapped, onBeforeSwap, reduced } = {}) {
  const btn = document.getElementById('langBtn');
  let lang = remembered() || 'vi';
  let busy = false;

  /* Re-queried on every apply rather than captured once: the signed-in
     pages build most of their content after this runs, and a snapshot
     taken at boot would leave every rendered course title stuck in the
     language it was created in. */
  const allNodes = () => Array.from(document.querySelectorAll('[data-i18n]'));
  /* Alt text is content, and content on this site is bilingual. Separate
     from the list above because it is an attribute, not the element's text —
     writing it through textContent would empty the <img>. */
  const allAlts = () => Array.from(document.querySelectorAll('[data-i18n-alt]'));

  function applyAlts() {
    allAlts().forEach(n => {
      const v = lang === 'en' ? n.dataset.altEn : n.dataset.altVi;
      if (v != null) n.setAttribute('alt', v);
    });
  }

  /* ── the toggle ──────────────────────────────────────── */
  function apply(next) {
    onBeforeSwap?.();          // unsplit first, or the split undo restores the old language
    lang = next;
    applyDocMeta(lang);
    btn?.setAttribute('aria-pressed', String(lang === 'en'));
    try { localStorage.setItem(STORE_KEY, lang); } catch { /* not worth failing over */ }
    allNodes().forEach(n => {
      const v = n.dataset[lang];
      if (v != null) n.textContent = v;
    });
    applyAlts();
  }

  async function swap() {
    if (busy) return;
    busy = true;
    const next = lang === 'vi' ? 'en' : 'vi';

    if (reduced) {
      apply(next);
      onSwapped?.();
      busy = false;
      return;
    }

    // only animate what's actually on screen — the rest just swaps
    const visible = allNodes().filter(n => {
      const r = n.getBoundingClientRect();
      return r.bottom > -80 && r.top < window.innerHeight + 80;
    });

    await gsap.to(visible, {
      yPercent: -55, opacity: 0, duration: 0.3,
      ease: 'power3.in', stagger: { each: 0.014, from: 'start' },
    });

    apply(next);
    onSwapped?.();

    gsap.fromTo(visible,
      { yPercent: 55, opacity: 0 },
      {
        yPercent: 0, opacity: 1, duration: 0.55,
        ease: 'power3.out', stagger: { each: 0.014, from: 'start' },
        onComplete: () => { gsap.set(visible, { clearProps: 'transform,opacity' }); busy = false; },
      });
  }

  btn?.addEventListener('click', swap);

  /* Apply the remembered language immediately, before first paint of any
     dynamic content, so an English reader never sees a Vietnamese flash.
     Vietnamese still goes through applyDocMeta rather than only setting
     `lang`: the markup ships Vietnamese, but the title and description have
     to be pointed at the data-* pair either way so a later toggle back has
     something to restore. */
  if (lang !== 'vi') apply(lang);
  else { applyDocMeta('vi'); applyAlts(); }
  btn?.setAttribute('aria-pressed', String(lang === 'en'));

  /* ── the hero's cycling word ─────────────────────────── */
  const cyc = document.getElementById('cycler');
  if (cyc && !reduced) {
    let i = 0, paused = false, hidden = false;
    const wrap = cyc.closest('.cyc-wrap') || cyc.parentElement;

    wrap?.addEventListener('pointerenter', () => { paused = true; });
    wrap?.addEventListener('pointerleave', () => { paused = false; });
    document.addEventListener('visibilitychange', () => { hidden = document.hidden; });

    setInterval(() => {
      if (paused || hidden || busy) return;
      const list = CYCLE[lang];
      i = (i + 1) % list.length;
      gsap.to(cyc, {
        yPercent: -100, opacity: 0, duration: 0.28, ease: 'power3.in',
        onComplete: () => {
          cyc.textContent = list[i];
          gsap.fromTo(cyc, { yPercent: 100, opacity: 0 },
                           { yPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
        },
      });
    }, 2700);
  }

  return {
    getLang: () => lang,
    /* Called by the views after they render, so freshly built nodes come
       up in the language already on screen instead of their authored one. */
    refresh() {
      allNodes().forEach(n => {
        const v = n.dataset[lang];
        if (v != null && n.textContent !== v) n.textContent = v;
      });
      applyAlts();
    },
  };
}
