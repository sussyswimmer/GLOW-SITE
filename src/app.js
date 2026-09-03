/* ═══════════════════════════════════════════════════════════
   The signed-in shell.

   Boots every app page: proves there is a session, fills the header
   with the real learner, routes to the view for this page, and keeps
   the reveal and progress-bar animations the prototype had — now
   driven by data instead of by hardcoded percentages.
   ═══════════════════════════════════════════════════════════ */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { initI18n, setDocTitle } from './i18n.js';
import { initInteractions } from './interact.js';
import { api, signOut, toLogin, ApiError } from './api.js';
import { el, clear, region, demoBanner, currentLang } from './ui.js';
import { renderDashboard, renderCourses, renderCourse, renderCatalog } from './views.js';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let i18n;

/* ── reveals ─────────────────────────────────────────────
   Called after each render rather than once at boot, because the content
   now arrives later than the page does.

   THE RULE THAT MATTERS HERE: an animation must never be the thing that
   decides whether content is visible. The prototype set every [data-rise]
   child to opacity 0 up front and waited for a ScrollTrigger to put it
   back — which is fine until the trigger does not fire, and then the
   learner is looking at an empty white box with no way to recover. It
   happened here the moment content became asynchronous: two whole track
   sections rendered blank because their trigger was never evaluated.

   So: anything already on screen animates immediately and unconditionally,
   only genuinely below-the-fold content is parked at opacity 0, and a
   watchdog puts everything back if a trigger has still not run. Motion is
   decoration, and decoration is not allowed to fail closed. */
function reveals(root = document) {
  if (reduced) return;

  root.querySelectorAll('[data-rise]:not([data-risen])').forEach(node => {
    node.dataset.risen = '1';
    const kids = node.children.length ? [...node.children] : [node];

    const box = node.getBoundingClientRect();
    const onScreen = box.top < window.innerHeight * 0.95;

    if (onScreen) {
      /* No trigger involved: it is already visible, so it plays now. */
      gsap.fromTo(kids,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.06,
          clearProps: 'transform,opacity' });
      return;
    }

    gsap.fromTo(kids,
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.06,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: node, start: 'top 92%', once: true } });
  });

  clearTimeout(reveals.watchdog);
  reveals.watchdog = setTimeout(forceVisible, 2500);
}

/* The safety net. Anything still fully transparent after the reveals have
   had their chance is shown outright — a missed animation should cost a
   flourish, never the content. */
function forceVisible() {
  document.querySelectorAll('[data-rise] > *').forEach(kid => {
    if (Number(getComputedStyle(kid).opacity) < 0.05) {
      gsap.set(kid, { clearProps: 'transform,opacity' });
      kid.style.opacity = '';
      kid.style.transform = '';
    }
  });
}

/* Progress bars count up to whatever the server actually reported. */
function meters(root = document) {
  root.querySelectorAll('.bar i:not([data-run])').forEach(bar => {
    bar.dataset.run = '1';
    const pct = Number(bar.dataset.pct || 0);
    const label = bar.closest('.tile-foot')?.querySelector('.bar-pct');

    if (reduced) {
      bar.style.width = pct + '%';
      if (label) label.textContent = pct + '%';
      return;
    }
    gsap.set(bar, { width: '0%' });
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: bar, start: 'top 96%', once: true,
      onEnter: () => gsap.to(o, {
        v: pct, duration: 1.1, ease: 'power2.out',
        onUpdate: () => {
          bar.style.width = o.v + '%';
          if (label) label.textContent = Math.round(o.v) + '%';
        },
      }),
    });
  });
}

/* Everything a view adds needs the same three passes afterwards. */
function afterRender(root) {
  i18n?.refresh();
  reveals(root);
  meters(root);
  ScrollTrigger.refresh();
}

/* Which page this is, as the filename the routing table is keyed on.
   NOT simply the last path segment: a CDN will serve `dashboard.html` at
   `/dashboard` and may rewrite our own links to that extensionless form, and
   people type it by hand. Without the extension the lookup below misses, the
   router decides this is a static page with nothing to load, and the shell
   renders with no data and no redirect to sign in — which looks exactly like
   a broken dashboard rather than a signed-out one. */
function pageName() {
  const last = location.pathname.split('/').pop() || 'index.html';
  return last.includes('.') ? last : `${last}.html`;
}

function markNav() {
  const here = pageName();
  document.querySelectorAll('.appnav a[data-page]').forEach(a => {
    if (a.dataset.page === here) a.setAttribute('aria-current', 'page');
  });
}

/* ── the header, filled from the session ───────────────────
   The shell ships SIGNED OUT — see the note in tools/build-pages.mjs. This
   is the only thing that moves it, and it is called on every path through
   boot(), including the ones where the session check failed, so the header
   can never be left in the state it was authored in by accident.

   The old version of this function was only ever called with a learner, and
   the markup carried "—" for the name and "·" for the avatar so that a
   failed load would not show somebody else's identity. It meant every
   signed-out visitor met a header addressing an em dash and offering to sign
   them out. A placeholder that has to be explained is not a placeholder;
   there are two states here and both are now rendered honestly. */
function setAuthState(learner) {
  const who = document.querySelector('.who');
  const out = document.getElementById('signOut');
  const inn = document.getElementById('signIn');
  const name = document.querySelector('.who-name');
  const avatar = document.querySelector('.appbar .avatar');

  if (!learner) {
    if (name) clear(name);
    if (avatar) avatar.textContent = '';
    who?.setAttribute('hidden', '');
    out?.setAttribute('hidden', '');
    inn?.removeAttribute('hidden');
    return;
  }

  if (name) {
    clear(name);
    name.append(document.createTextNode(learner.fullname));
    if (learner.username) name.append(el('span', { class: 'who-id', text: learner.username }));
  }
  if (avatar) avatar.textContent = learner.initials || '?';

  if (who) {
    who.setAttribute('href', './dashboard.html');
    who.setAttribute('aria-label',
      document.documentElement.lang === 'en' ? `Signed in as ${learner.fullname}` : `Đang đăng nhập: ${learner.fullname}`);
    who.removeAttribute('hidden');
  }

  inn?.setAttribute('hidden', '');
  if (out) {
    out.removeAttribute('hidden');
    out.addEventListener('click', e => { e.preventDefault(); signOut(); });
  }

  /* The two nav items that only exist for a signed-in learner. They ship
     hidden on the public catalogue pages so a crawler is not offered a
     dashboard it can never reach. */
  document.querySelectorAll('.appnav a[data-private]').forEach(a => a.removeAttribute('hidden'));
}

/* ── routes ──────────────────────────────────────────────── */
const ROUTES = {
  'dashboard.html': {
    host: '#view',
    load: () => api.dashboard(),
    render: renderDashboard,
    skeleton: 'tiles',
  },
  'courses.html': {
    host: '#view',
    load: () => api.courses(),
    render: renderCourses,
    skeleton: 'tiles',
  },
  'course.html': {
    host: '#view',
    load: () => {
      const id = new URLSearchParams(location.search).get('id');
      if (!id) {
        /* Arriving with no course chosen is a navigation mistake, not an
           error — send them to the list rather than showing a failure. */
        location.replace('./courses.html');
        return new Promise(() => {});   // never resolves; the page is leaving
      }
      return api.course(id);
    },
    render: renderCourse,
    skeleton: 'rows',
    onError: courseHeading,
  },
  /* PUBLIC. The catalogue is already in the markup — tools/build-pages.mjs
     writes it there from the same data the API serves — so these two do not
     gate on a session and do not blank the page to fetch what they already
     have. A signed-in learner still gets a refresh, because on a live Moodle
     the API knows about enrolments and the build-time snapshot does not. */
  'english.html': {
    host: '#view',
    load: () => api.catalog('english'),
    render: renderCatalog,
    skeleton: 'rows',
    public: true,
  },
  'resources.html': {
    host: '#view',
    load: () => api.catalog('resources'),
    render: renderCatalog,
    skeleton: 'rows',
    public: true,
  },
};

/* ── the course page's heading, when the course never arrives ───
   The shell opens on "Đang tải…" with "Khoá học" as the last breadcrumb,
   and renderCourse replaces both with the course name. Nothing replaced
   them when the fetch failed, so a mistyped id — or a dropped connection —
   left the page reading "Loading…" for ever, under a browser tab that
   still said "Course | GLOW". The error panel below it said what happened;
   the top third of the page contradicted it.

   A 404 or a 400 from this route means the id is not a course: that is a
   different sentence from "the server is having a bad day", and it is the
   one a learner following a stale link actually needs. */
function courseHeading(err) {
  const missing = err?.status === 404 || err?.status === 400;
  const vi = missing ? 'Không tìm thấy khoá học' : 'Không tải được khoá học';
  const en = missing ? 'Course not found' : "This course didn't load";

  const h1 = document.querySelector('.pagehead h1');
  if (h1) { h1.dataset.vi = vi; h1.dataset.en = en; h1.textContent = currentLang() === 'en' ? en : vi; }

  const crumbNow = document.querySelector('.crumbs .crumb-now');
  if (crumbNow) {
    crumbNow.dataset.vi = vi;
    crumbNow.dataset.en = en;
    crumbNow.textContent = currentLang() === 'en' ? en : vi;
  }

  setDocTitle(`${vi} | GLOW`, `${en} | GLOW`);
}

async function boot() {
  markNav();
  initInteractions({ reduced });
  i18n = initI18n({ reduced });

  const page = pageName();
  const route = ROUTES[page];
  if (!route) return;                   // a static page, nothing to load

  /* One session check before any data call, so an expired session sends
     the learner to sign in instead of painting four broken panels. */
  let me = null;
  try {
    me = await api.me();
  } catch (err) {
    /* `required`, not `expired`. This is the FIRST session check of the page
       load, so a 401 here means only that there is no session now — not that
       there ever was one. Most people who reach it are first-time visitors who
       clicked a nav item, and telling them their session expired is both false
       and faintly accusing. The focus re-check below is the one that can say
       `expired` honestly: it only runs after a page has already rendered
       signed in. */
    if (err instanceof ApiError && err.kind === 'auth') {
      /* On a public page there is nothing to redirect to: not being signed in
         is a normal way to read it, not a failure. */
      if (!route.public) return toLogin('required');
    } else {
      /* The server is unreachable rather than the session being bad. Let the
         region below render that honestly — do not bounce them to a login
         page that will not load either. */
    }
    me = null;
  }

  setAuthState(me?.learner || null);
  if (me?.demo) demoBanner();

  const host = document.querySelector(route.host);
  if (!host) return;

  /* A public page read signed out keeps the markup it was built with. There
     is nothing to fetch that it does not already have, and blanking real,
     indexed content to show a skeleton — then an error panel, because the
     API needs a session — would be strictly worse than doing nothing. */
  if (route.public && !me) {
    i18n?.refresh();
    ScrollTrigger.refresh();
    return;
  }

  await region(host, route.load, (data, node) => {
    if (data?.demo) demoBanner();
    route.render(data, node);
    afterRender(node);
  }, { skeleton: route.skeleton, onError: route.onError });

  /* A session that ends while the tab is open should not leave a stale
     page that looks signed in. Re-checking on focus catches the case
     where they signed out in another tab. */
  window.addEventListener('focus', async () => {
    try { await api.me(); }
    catch (err) {
      if (!(err instanceof ApiError) || err.kind !== 'auth') return;
      /* On a public page, losing the session means the header goes back to
         signed out — not that the reader is thrown off the page they are
         reading. Only the gated pages have somewhere to send them. */
      if (route.public) { setAuthState(null); return; }
      toLogin('expired');
    }
  });
}

boot();
