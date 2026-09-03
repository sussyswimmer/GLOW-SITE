/* ═══════════════════════════════════════════════════════════
   Rendering primitives.

   Two rules hold this file together:

   1. NOTHING IS BUILT WITH innerHTML FROM DATA. Course titles, learner
      names and activity names all come from a system whose content is
      edited by people, and Moodle happily returns "<script>" inside a
      course name if someone typed it. Text goes in through textContent,
      which cannot execute, and structure is built from real elements.
      This is the whole XSS story for the front end, so it is not a
      style preference and there is no exception.

   2. Every asynchronous region has four renderings — loading, ready,
      empty and failed — and `region()` below makes it awkward to build
      one without the other three. A view that only handles "ready" is
      the one that shows a blank white box on a bad connection.
   ═══════════════════════════════════════════════════════════ */

/** el('div', {class:'x', onclick:fn}, child, 'text') */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;          // never innerHTML
    else if (k === 'html') node.innerHTML = v;            // only for our own literal SVG
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }

  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Bilingual text node: swaps with the language toggle. See i18n.js. */
export function t(vi, en) {
  return el('span', { 'data-i18n': '', 'data-vi': vi, 'data-en': en, text: currentLang() === 'en' ? en : vi });
}

/** Bilingual attribute set on an existing element, for headings and labels. */
export function bilingual(node, vi, en) {
  node.setAttribute('data-i18n', '');
  node.dataset.vi = vi;
  node.dataset.en = en;
  node.textContent = currentLang() === 'en' ? en : vi;
  return node;
}

export function currentLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'vi';
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ── icons ───────────────────────────────────────────────
   Literal, authored SVG — the one place `html` is used, and only ever
   with strings from this file. */
const ICONS = {
  url: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  page: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  quiz: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  assign: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  forum: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  scheduler: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  other: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  empty: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  /* A search that found nothing — distinct from `empty`, which is a calendar
     and belongs to "nothing scheduled". A stale course link is not an empty
     diary. */
  missing: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/><path d="M8.5 8.5l5 5M13.5 8.5l-5 5"/>',
  offline: '<path d="M1 1l22 22"/><path d="M16.7 16.7A10.9 10.9 0 0 1 12 18l-.7.7"/><path d="M5 12.6a10.9 10.9 0 0 1 4-2.4M10.7 5.1a16 16 0 0 1 10.9 4.4"/><path d="M2.4 9.5a16 16 0 0 1 3.7-2.6"/><path d="M12 20h.01"/>',
};

export function icon(name, cls) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  svg.innerHTML = ICONS[name] || ICONS.other;   // literal, from the table above
  return svg;
}

/* ── the four states ─────────────────────────────────────── */

/**
 * Wrap an async load in its own region, so a failure is contained to the
 * part of the page that failed. The dashboard's calendar going down should
 * cost you the calendar, not the whole screen.
 *
 * @param {HTMLElement} host     where to render
 * @param {() => Promise<any>} load
 * @param {(data:any, host:HTMLElement) => void} render
 * `onError` is for the parts of the page that live OUTSIDE this region and
 * still have to react to it — the course page's heading and breadcrumb sit
 * in the shell, and were the one thing that went on claiming the course was
 * loading after this had already given up on it.
 *
 * @param {object} opts  { empty: () => boolean, label: [vi,en], onError: (err) => void }
 */
export async function region(host, load, render, opts = {}) {
  const { skeleton = 'tiles', label = ['Đang tải…', 'Loading…'] } = opts;

  clear(host).append(skeletonFor(skeleton, label));

  let data;
  try {
    data = await load();
  } catch (err) {
    clear(host).append(errorState(err, () => region(host, load, render, opts)));
    opts.onError?.(err);
    return;
  }

  clear(host);
  try {
    render(data, host);
  } catch (err) {
    /* A bug in our own rendering, not a failed request. Say so honestly
       rather than blaming the connection — and log it, because this one
       is ours to fix. */
    console.error('[glow] render failed', err);
    clear(host).append(errorState(new Error('render'), () => region(host, load, render, opts)));
    opts.onError?.(err);
    return;
  }

  /* Nothing was produced: a real, valid, empty answer. Distinct from a
     failure, and it gets a different sentence. */
  if (!host.children.length && opts.empty) host.append(opts.empty());
}

/** A shape-matched placeholder, so the page does not jump when data lands. */
export function skeletonFor(kind, label) {
  const box = el('div', {
    class: `skel skel-${kind}`,
    role: 'status',
    'aria-live': 'polite',
    'aria-busy': 'true',
  });
  const n = kind === 'tiles' ? 3 : kind === 'rows' ? 4 : 1;
  for (let i = 0; i < n; i++) box.append(el('div', { class: 'skel-item' }));
  /* Screen readers get words; sighted users get the shapes. */
  box.append(el('span', { class: 'sr-only' }, t(label[0], label[1])));
  return box;
}

export function errorState(err, retry) {
  const offline = err?.kind === 'offline';
  const auth = err?.kind === 'auth';
  /* A 404 is the server answering correctly, and a 400 here is an id that is
     not an id — a stale bookmark or a hand-edited query string, not a fault.
     "Try again in a moment" is wrong advice for both: retrying a link to a
     course that does not exist will fail identically for ever. */
  const missing = !auth && !offline && (err?.status === 404 || err?.status === 400);

  const wrap = el('div', { class: 'state state-error', role: 'alert' },
    icon(offline ? 'offline' : missing ? 'missing' : 'warn', 'state-ico'));

  wrap.append(el('p', { class: 'state-title' },
    offline ? t('Bạn đang ngoại tuyến', 'You are offline')
    : auth ? t('Phiên đăng nhập đã kết thúc', 'Your session has ended')
    : missing ? t('Không tìm thấy nội dung này', "We couldn't find that")
    : t('Không tải được phần này', "This section didn't load")));

  wrap.append(el('p', { class: 'state-body' },
    offline ? t('Kiểm tra kết nối mạng rồi thử lại.', 'Check your connection and try again.')
    : auth ? t('Đăng nhập lại để tiếp tục.', 'Sign in again to continue.')
    : missing ? t('Đường dẫn có thể đã cũ, hoặc khoá học đã được gỡ. Hãy chọn lại từ danh sách khoá học.',
                  'The link may be out of date, or the course may have been removed. Pick it again from your course list.')
    : t('Sự cố tạm thời. Thử lại sau giây lát.', 'A temporary problem. Try again in a moment.')));

  if (auth) {
    wrap.append(el('a', { class: 'btn btn-primary', href: './login.html' }, t('Đăng nhập', 'Sign in')));
  } else if (missing) {
    wrap.append(el('a', { class: 'btn btn-primary', href: './courses.html' },
      t('Khoá học của tôi', 'My courses')));
  } else if (retry) {
    wrap.append(el('button', { class: 'btn btn-quiet', type: 'button', onclick: retry },
      t('Thử lại', 'Try again')));
  }
  return wrap;
}

export function emptyState(vi, en, action) {
  const wrap = el('div', { class: 'state state-empty' }, icon('empty', 'state-ico'));
  wrap.append(el('p', { class: 'state-title' }, t(vi, en)));
  if (action) wrap.append(action);
  return wrap;
}

/* ── the demo banner ─────────────────────────────────────
   Shown whenever the server is serving illustrative data. Deliberately
   impossible to miss and impossible to dismiss: the failure mode this
   prevents is the foundation reviewing the site and believing it is
   looking at its own learners. */
export function demoBanner() {
  if (document.querySelector('.demo-bar')) return;
  const bar = el('div', { class: 'demo-bar', role: 'status' },
    icon('warn', 'demo-ico'),
    el('span', {},
      t('Dữ liệu mẫu — chưa kết nối với hệ thống thật.',
        'Sample data — not connected to the live platform yet.')),
  );
  document.body.prepend(bar);
  document.body.classList.add('has-demo-bar');
}

/* Dates, in the learner's language. Vietnamese day-month order differs,
   and Intl already knows that, so nothing here hand-formats a date. */
export function formatDate(iso, opts = { day: 'numeric', month: 'short' }) {
  try {
    return new Intl.DateTimeFormat(currentLang() === 'en' ? 'en-GB' : 'vi-VN', opts).format(new Date(iso));
  } catch {
    return '';
  }
}
