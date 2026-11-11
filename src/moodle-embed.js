/* ═══════════════════════════════════════════════════════════
   GLOW's landing page on Moodle's home page.

   Moodle's Additional HTML ("Before BODY is closed") holds ONE line:

     <script src="https://glow-pacific-links.netlify.app/embed/moodle.js"></script>

   and this file does the rest, on every visit, from whatever is live on
   this site: the markup (embed/landing.json), the CSS and the JS. Nothing
   about the landing page is copied into Moodle any more, so nothing there
   can go stale. Every deploy of this site is on Moodle's home page the
   next time someone opens it.

   Written to fail safe. Moodle's page is hidden while the landing page
   loads and only replaced once the markup, CSS and JS have all arrived. If
   any of them fails, or it takes too long, the veil comes off and the
   visitor gets Moodle's ordinary home page: never a half-styled one.

   Copied verbatim to dist/embed/moodle.js by tools/build.mjs; it is not
   bundled, so it stays plain ES2017 with no imports.

   Escape hatch for admins: add ?glow=off to the URL to see (and edit)
   Moodle's real home page.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var me = document.currentScript;
  var body = document.body;
  if (!me || !body || body.id !== 'page-site-index') return;   // home page only
  if (/[?&]glow=off(&|$)/.test(location.search)) return;

  /* Where this script came from is where everything else lives, so the
     same line works against Netlify, Render or a local server. */
  var GLOW = new URL('..', me.src).href.replace(/\/$/, '');
  var cfg = (window.M && window.M.cfg) || {};
  var MOODLE = (cfg.wwwroot || location.origin).replace(/\/$/, '');
  var LANG = /^vi/i.test(cfg.language || document.documentElement.lang || '') ? 'vi' : 'en';
  var FONTS = 'https://fonts.googleapis.com/css2?family=Anybody:wght@600;700;800&family=Roboto:wght@300;400;500;700&display=swap';
  var TIMEOUT_MS = 10000;

  var head = document.head;
  var root = document.documentElement;
  var added = [];
  function add(el) { head.appendChild(el); added.push(el); return el; }

  var veil = document.createElement('style');
  veil.textContent = 'body{visibility:hidden!important}';
  add(veil);

  var settled = false;
  function giveUp(why) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    added.forEach(function (el) { el.remove(); });
    console.warn('[GLOW] landing page not loaded, showing the Moodle home page instead:', why);
  }
  var timer = setTimeout(function () { giveUp('timed out after ' + TIMEOUT_MS + 'ms'); }, TIMEOUT_MS);

  function loaded(el, what) {
    return new Promise(function (resolve, reject) {
      el.onload = resolve;
      el.onerror = function () { reject(new Error(what + ' failed to load')); };
    });
  }

  var fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = FONTS;
  add(fonts);

  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = GLOW + '/embed/landing.css';
  var cssReady = loaded(css, 'landing.css');
  add(css);

  /* Fetched now, executed after the swap: a script that fails AFTER the
     body is replaced would leave the preloader covering the page for good,
     so it has to be known good before anything is touched. */
  var preload = document.createElement('link');
  preload.rel = 'preload';
  preload.as = 'script';
  preload.href = GLOW + '/embed/landing.js';
  var jsReady = loaded(preload, 'landing.js');
  add(preload);

  var markup = fetch(GLOW + '/embed/landing.json', { cache: 'no-cache', credentials: 'omit' })
    .then(function (r) {
      if (!r.ok) throw new Error('landing.json returned ' + r.status);
      return r.json();
    });

  Promise.all([markup, cssReady, jsReady]).then(function (res) {
    if (settled) return;
    var page = res[0];
    settled = true;
    clearTimeout(timer);

    /* Moodle's theme would otherwise restyle the landing page's buttons,
       links and headings (it is why the broken page had yellow buttons). */
    Array.prototype.forEach.call(head.querySelectorAll('link[rel="stylesheet"]'), function (l) {
      if (l !== css && l !== fonts) l.remove();
    });

    root.lang = LANG;
    root.dataset.glowDefaultLang = LANG;
    root.dataset.titleVi = page.title.vi;
    root.dataset.titleEn = page.title.en;
    root.dataset.descVi = page.desc.vi;
    root.dataset.descEn = page.desc.en;
    document.title = page.title[LANG];

    /* Moodle's own session, read before the class is cleared: the GLOW API is
       not on this origin, so landing.js cannot ask it. Core puts "notloggedin"
       on <body> for visitors; the guest account counts as logged in there, so
       it is told apart by user id. Fails safe: no M.cfg means not signed in.
       shortcut: guest id assumed to be 1 (Moodle's default), anonymous is 0. */
    if (!/(^|\s)notloggedin(\s|$)/.test(body.className) && Number(window.M && window.M.cfg && window.M.cfg.userId) > 1) root.dataset.glowMoodleIn = '1';

    body.id = 'glow-landing-page';
    body.className = '';
    body.innerHTML = page.html.split('%%GLOW%%').join(GLOW).split('%%MOODLE%%').join(MOODLE);

    var js = document.createElement('script');
    js.src = preload.href;
    js.onerror = function () {
      /* Already checked once, so this is a network blip mid-swap. Moodle's
         own home page beats a page stuck behind its preloader. */
      location.replace(location.pathname + (location.search ? location.search + '&' : '?') + 'glow=off');
    };
    body.appendChild(js);
    veil.remove();
  }).catch(function (err) { giveUp(err && err.message); });
})();
