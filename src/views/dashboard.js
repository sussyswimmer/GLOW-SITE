/* ═══════════════════════════════════════════════════════════
   The dashboard. Main column, in phone order: Ask EMMAI, recommended,
   pinned, my courses, recently accessed. Rail: calendar, coming up,
   tuition. The desktop grid only puts the rail beside the main column.

   Every block degrades on its own: the live Moodle adapter sends no
   recommended / pinned / emmai and no hours or lessons, and a block with
   nothing to say is left out rather than shown empty. Nothing here
   invents a number the platform did not send.
   ═══════════════════════════════════════════════════════════ */

import { el, t, icon, clear, emptyState, currentLang, region } from '../ui.js';
import { api } from '../api.js';
import { openEmmai } from '../emmai.js';
import { statusPill, statusHint } from '../views.js';

const DAY = 86_400_000;
const LOCALE = { vi: 'vi-VN', en: 'en-GB' };

const CATEGORY = {
  english: { vi: 'Học tiếng Anh', en: 'English Learning' },
  skills: { vi: 'Kỹ năng & Kết nối', en: 'Skills & Network Building' },
  training: { vi: 'Đào tạo nội bộ', en: 'Training' },
};

export function renderDashboard(d, host) {
  /* The heading stays "Dashboard"; the shell's own sub-heading is the brief's. */
  const main = el('div', { class: 'dash-main' },
    hello(d),
    emmaiCard(d.emmai),
    recommended(d.recommended || []),
    pinned(d.pinned),
    myCourses(d.courses || []),
    recent(d.recent || []));
  host.append(main, el('div', { class: 'dash-rail' }, ...calendarAndUpcoming(d), tuitionCard()));
}

/* ── small helpers ───────────────────────────────────────── */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const cap = s => s.charAt(0).toLocaleUpperCase('vi') + s.slice(1);
const fmt = (d, opts, lang) => new Intl.DateTimeFormat(LOCALE[lang], opts).format(d);
/* A date that follows the VI/EN toggle: both texts are rendered now. */
const both = (d, opts) => t(cap(fmt(d, opts, 'vi')), cap(fmt(d, opts, 'en')));
const clock = d => fmt(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, 'en');

/* "hôm qua", "3 days ago" — Intl knows both languages' phrasing. */
function ago(iso, lang) {
  const days = Math.round((startOfDay(iso) - startOfDay(Date.now())) / DAY);
  try {
    const s = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' }).format(days, 'day');
    return s.charAt(0).toLocaleLowerCase('vi') + s.slice(1);
  } catch {
    return fmt(new Date(iso), {}, lang);
  }
}

function section(id, titleVi, titleEn, extra, ...content) {
  return el('section', { class: 'dash-sec', 'aria-labelledby': id },
    el('div', { class: 'sec-head' }, el('h2', { id }, t(titleVi, titleEn)), extra),
    ...content);
}

function ssoLink(path, cls, ...label) {
  return el('a', {
    class: cls, href: `/api/sso?to=${encodeURIComponent(path)}`, target: '_blank', rel: 'noopener noreferrer',
  }, ...label, el('span', { class: 'sr-only' }, t(' (mở tab mới)', ' (opens in a new tab)')));
}

/* ── hello + Ask EMMAI ───────────────────────────────────── */

function hello(d) {
  const name = d.learner.fullname;
  const p = el('p', { class: 'dash-hello' }, t(`Xin chào, ${name}`, `Hello, ${name}`));
  const n = Number(d.unread) || 0;
  if (n) {
    p.append(' · ', ssoLink('/message/output/popup/notifications.php', 'dash-hello-link',
      t(`${n} thông báo mới`, `${n} new ${n === 1 ? 'notification' : 'notifications'}`)));
  }
  return p;
}

function emmaiCard(emmai) {
  const vi = emmai?.vi || 'Hỏi EMMAI để tìm khoá học phù hợp với mục tiêu của bạn.';
  const en = emmai?.en || 'Ask EMMAI to find the course that fits your goals.';
  return el('section', { class: 'dash-emmai', 'data-rise': '', 'aria-labelledby': 'dash-emmai-h' },
    el('p', { class: 'dash-kick' }, 'EMMAI'),
    el('h2', { id: 'dash-emmai-h' }, t(vi, en)),
    el('p', { class: 'dash-emmai-sub' }, t('Cố vấn AI của GLOW: gợi ý khoá học và giải đáp thắc mắc về việc học.',
      "GLOW's AI advisor: course suggestions and answers about your learning.")),
    el('button', {
      class: 'btn btn-primary', type: 'button', 'data-emmai-open': '',
      /* Only a real EMMAI line is sent as the opening question; the generic
         line is an invitation to ask, not something to ask. */
      onclick: () => openEmmai(emmai ? { prompt: currentLang() === 'en' ? emmai.en : emmai.vi } : {}),
    }, icon('forum', 'btn-ico'), t('Hỏi EMMAI', 'Ask EMMAI')));
}

/* ── course cards ────────────────────────────────────────── */

function categoryLabel(c) {
  const k = CATEGORY[c.categoryKey];
  if (k) return t(k.vi, k.en);
  return c.category ? el('span', { text: c.category }) : null;
}

function progressBar(pct) {
  const v = Math.round(pct || 0);
  /* .tile-foot is what app.js's count-up looks for to find the % label. */
  return el('div', { class: 'tile-foot dc-prog' },
    el('div', {
      class: 'bar', role: 'progressbar', 'aria-valuenow': v, 'aria-valuemin': 0, 'aria-valuemax': 100,
      'aria-label': currentLang() === 'en' ? 'Course progress' : 'Tiến độ khoá học',
    }, el('i', { dataset: { pct: String(v) } })),
    el('span', { class: 'bar-pct', text: '0%' }));
}

/** summary: show the blurb (courses the learner has not started).
    stats: hours / lessons / last opened, each only if the data has it. */
function courseCard(c, { summary = false, stats = false } = {}) {
  const card = el('a', { class: 'dc', href: c.href, 'data-cat': c.categoryKey || '' });
  const meta = el('p', { class: 'dc-meta' });
  const cat = categoryLabel(c);
  if (c.code) meta.append(el('span', { class: 'dc-code' }, el('span', { class: 'sr-only' }, t('Mã khoá học: ', 'Course code: ')), c.code));
  if (cat) meta.append(el('span', { class: 'dc-cat' }, cat));
  card.append(meta, el('h3', {}, t(c.titleVi || c.title, c.title)));

  if (summary && c.summary) card.append(el('p', { class: 'dc-sum', text: c.summary }));
  if (c.tracked && c.enrolled) card.append(progressBar(c.progress));

  if (stats) {
    const list = el('ul', { class: 'dc-stats' });
    const stat = (ico, ...kids) => list.append(el('li', {}, icon(ico), el('span', {}, ...kids)));
    if (Number.isFinite(c.hours)) stat('other', t(`${c.hours} giờ học`, `${c.hours} h studied`));
    if (Number.isFinite(c.lessonsDone) && Number.isFinite(c.lessonsTotal)) {
      stat('check', t(`${c.lessonsDone} / ${c.lessonsTotal} bài`, `${c.lessonsDone} / ${c.lessonsTotal} lessons`));
    }
    if (c.lastAccess) stat('empty', t(`Mở lần cuối ${ago(c.lastAccess, 'vi')}`, `Last opened ${ago(c.lastAccess, 'en')}`));
    if (list.children.length) card.append(list);
  }
  return card;
}

const cardGrid = (courses, opts, cls = '') =>
  el('div', { class: `dc-grid ${cls}`, 'data-rise': '' }, courses.map(c => courseCard(c, opts)));

const nothing = () => document.createDocumentFragment();

function recommended(courses) {
  if (!courses.length) return nothing();
  return section('dash-rec-h', 'Gợi ý cho bạn', 'Recommended for you', null,
    cardGrid(courses, { summary: true }));
}

function pinned(p) {
  if (!p?.courses?.length) return nothing();
  return section('dash-pin-h', p.titleVi || p.titleEn, p.titleEn || p.titleVi, null,
    cardGrid(p.courses, { summary: true }));
}

function myCourses(courses) {
  const link = el('a', { class: 'sec-link', href: './courses.html' }, t('Tất cả khoá học', 'All courses'));
  return section('dash-mine-h', 'Khoá học của tôi', 'My courses', link,
    courses.length
      ? cardGrid(courses, {})
      : emptyState('Bạn chưa được ghi danh vào khoá học nào.', "You aren't enrolled in a course yet.",
        el('a', { class: 'btn btn-primary', href: './english.html' }, t('Xem khoá học tiếng Anh', 'Browse English courses'))));
}

function recent(courses) {
  /* Moodle's fallback for a learner who has opened nothing is their first
     enrolments; "recently accessed" would claim a history they do not have. */
  const seen = courses.filter(c => c.lastAccess);
  if (!seen.length) return nothing();
  return section('dash-recent-h', 'Khoá học truy cập gần đây', 'Recently accessed courses', null,
    cardGrid(seen, { stats: true }, 'dc-grid-recent'));
}

/* ── tuition ─────────────────────────────────────────────── */

/* Its own region, so a billing hiccup costs the learner this card and not
   the dashboard. */
function tuitionCard() {
  const body = el('div');
  region(body, () => api.billing(), (b, node) => {
    node.append(statusPill(b.status), el('p', { class: 'pay-hint' }, statusHint(b)));
    node.append(el('a', { class: 'btn btn-quiet', href: './payment.html' }, b.status === 'unpaid'
      ? t('Xem cách thanh toán', 'See how to pay')
      : t('Xem chi tiết thanh toán', 'See payment details')));
  }, { skeleton: 'card' });

  return el('section', { class: 'panel dash-pay', 'aria-labelledby': 'dash-pay-h' },
    el('div', { class: 'sec-head' }, el('h2', { id: 'dash-pay-h' }, t('Học phí', 'Tuition'))),
    body);
}

/* ── calendar + coming up ────────────────────────────────── */

/* shortcut: browser-only until Moodle core_calendar_create_calendar_events is wired */
function loadLocal(storeKey) {
  try {
    const list = JSON.parse(localStorage.getItem(storeKey) || '[]');
    return (Array.isArray(list) ? list : [])
      .filter(e => e && typeof e.id === 'string' && typeof e.title === 'string' && Number.isFinite(Date.parse(e.when)))
      .map(e => ({ id: e.id, title: e.title.slice(0, 80), when: new Date(e.when), local: true }));
  } catch {
    return [];   // storage blocked or corrupt: the calendar still works, just without saved events
  }
}

const WEEKDAYS = [['T2', 'Mon'], ['T3', 'Tue'], ['T4', 'Wed'], ['T5', 'Thu'], ['T6', 'Fri'], ['T7', 'Sat'], ['CN', 'Sun']];

function calendarAndUpcoming(d) {
  const storeKey = `glow.events.${d.learner.id}`;
  const served = (d.events || []).map(e => ({
    id: String(e.id), title: e.title, titleVi: e.titleVi, courseTitle: e.courseTitle,
    href: e.href, when: new Date(e.when), local: false,
  })).filter(e => !Number.isNaN(e.when.getTime()));
  let mine = loadLocal(storeKey);
  const all = () => [...served, ...mine].sort((a, b) => a.when - b.when);

  const today = new Date();
  let month = new Date(today.getFullYear(), today.getMonth(), 1);
  let sel = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const saveNote = el('p', { class: 'cal-note', role: 'status' });
  function save() {
    try {
      localStorage.setItem(storeKey, JSON.stringify(mine.map(e => ({ id: e.id, title: e.title, when: e.when.toISOString() }))));
      clear(saveNote);
    } catch {
      clear(saveNote).append(t('Không lưu được trên thiết bị này; sự kiện chỉ còn đến khi bạn đóng trang.',
        'Could not save on this device; the event only lasts until you close the page.'));
    }
  }

  /* One item for both lists. Events added here can be deleted here. */
  function eventItem(e, { badge }) {
    const now = Date.now();
    const days = Math.round((startOfDay(e.when) - startOfDay(now)) / DAY);
    const tag = e.when < now ? null
      : days <= 0 ? { vi: 'Hôm nay', en: 'Today' }
      : days === 1 ? { vi: 'Ngày mai', en: 'Tomorrow' }
      : null;
    const title = e.titleVi ? t(e.titleVi, e.title) : el('span', { text: e.title });
    /* Skip the course name when either title already carries it (Moodle events too). */
    const course = (e.courseTitle || '').toLowerCase();
    const repeated = !!course && [e.title, e.titleVi].some(s => (s || '').toLowerCase().includes(course));
    const meta = el('span', { class: 'event-meta' }, [repeated ? null : e.courseTitle, clock(e.when)].filter(Boolean).join(' · '));
    if (e.local) meta.append(' · ', t('chỉ trên thiết bị này', 'only on this device'));

    const li = el('li', { class: `event${tag ? ' is-soon' : ''}` });
    if (badge) {
      li.append(el('time', { class: 'event-date', datetime: e.when.toISOString() },
        el('span', { class: 'event-day', text: String(e.when.getDate()) }),
        el('span', { class: 'event-mon' }, t(`thg ${e.when.getMonth() + 1}`, fmt(e.when, { month: 'short' }, 'en')))));
    }
    li.append(el('div', { class: 'event-main' },
      e.href ? el('a', { href: e.href }, title) : el('span', { class: 'event-title' }, title), meta));
    if (tag && badge) li.append(el('span', { class: 'pill pill-soon' }, t(tag.vi, tag.en)));
    if (e.local) {
      li.append(el('button', {
        class: 'cal-del', type: 'button',
        onclick() {
          mine = mine.filter(x => x.id !== e.id);
          save();
          refresh(true);
        },
      }, icon('close'), el('span', { class: 'sr-only' }, t('Xoá sự kiện: ', 'Delete event: '), e.title)));
    }
    return li;
  }

  /* ── the calendar ── */
  const monthLabel = el('h3', { class: 'cal-month', 'aria-live': 'polite' });
  const grid = el('div', { class: 'cal-grid', role: 'group' });
  const dayList = el('div', { class: 'cal-day' });

  /* Moving months selects today when it is in view, otherwise the 1st. */
  function shift(n) {
    month = new Date(month.getFullYear(), month.getMonth() + n, 1);
    const inView = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();
    sel = inView ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : new Date(month);
    refresh(false);
  }
  const navBtn = (n, viLabel, enLabel, cls) => el('button', { class: 'cal-nav', type: 'button', onclick: () => shift(n) },
    icon('chevron', cls), el('span', { class: 'sr-only' }, t(viLabel, enLabel)));

  function drawGrid() {
    clear(grid);
    WEEKDAYS.forEach(([vi, en]) => grid.append(el('span', { class: 'cal-wd' }, t(vi, en))));
    grid.append(...Array.from({ length: (month.getDay() + 6) % 7 }, () => el('span', { 'aria-hidden': 'true' })));
    const counts = new Map();
    all().forEach(e => { const k = dayKey(e.when); counts.set(k, (counts.get(k) || 0) + 1); });
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    for (let n = 1; n <= total; n++) {
      const day = new Date(month.getFullYear(), month.getMonth(), n);
      const k = dayKey(day);
      const c = counts.get(k) || 0;
      const isSel = k === dayKey(sel);
      grid.append(el('button', {
        type: 'button', 'aria-pressed': String(isSel), tabindex: isSel ? '0' : '-1',
        class: `cal-d${k === dayKey(today) ? ' is-today' : ''}${isSel ? ' is-sel' : ''}${c ? ' has-ev' : ''}`,
        onclick() { sel = day; refresh(true); },
      },
      el('span', { text: String(n), 'aria-hidden': 'true' }),
      el('span', { class: 'sr-only' }, both(day, { weekday: 'long', day: 'numeric', month: 'long' }),
        c ? t(`, ${c} sự kiện`, `, ${c} ${c === 1 ? 'event' : 'events'}`) : null)));
    }
  }

  function drawDay() {
    clear(dayList);
    const evs = all().filter(e => dayKey(e.when) === dayKey(sel));
    dayList.append(el('h4', {}, both(sel, { weekday: 'long', day: 'numeric', month: 'long' })));
    dayList.append(evs.length
      ? el('ul', { class: 'events' }, evs.map(e => eventItem(e, { badge: false })))
      : el('p', { class: 'cal-empty' }, t('Không có sự kiện trong ngày này.', 'No events on this day.')));
  }

  /* Arrow keys move the selection; only the selected day is in the tab order,
     so Tab does not walk thirty buttons. */
  grid.addEventListener('keydown', ev => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
    if (!step || !ev.target.closest('.cal-d')) return;
    ev.preventDefault();
    sel = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate() + step);
    month = new Date(sel.getFullYear(), sel.getMonth(), 1);
    refresh(true);
  });

  /* ── coming up ── */
  const upList = el('div');
  function drawUpcoming() {
    clear(upList);
    const next = all().filter(e => e.when.getTime() >= Date.now()).slice(0, 5);
    upList.append(next.length
      ? el('ul', { class: 'events' }, next.map(e => eventItem(e, { badge: true })))
      : emptyState('Không có sự kiện sắp tới.', 'No upcoming events.'));
  }

  function refresh(focusDay) {
    clear(monthLabel).append(both(month, { month: 'long', year: 'numeric' }));
    drawGrid();
    drawDay();
    drawUpcoming();
    if (focusDay) grid.querySelector('.is-sel')?.focus();
  }

  /* ── new event dialog ── */
  const titleIn = el('input', { id: 'ev-title', name: 'title', type: 'text', required: true, maxlength: 80, autocomplete: 'off' });
  const dateIn = el('input', { id: 'ev-date', name: 'date', type: 'date', required: true });
  const timeIn = el('input', { id: 'ev-time', name: 'time', type: 'time', required: true, value: '09:00' });
  const err = el('p', { class: 'cal-err', role: 'alert' });
  const dialog = el('dialog', { class: 'cal-dialog', 'aria-labelledby': 'ev-h' },
    el('form', {
      method: 'dialog', novalidate: true,
      onsubmit(ev) {
        ev.preventDefault();
        const title = titleIn.value.trim();
        const [y, m, dd] = dateIn.value.split('-').map(Number);
        const [hh, mm] = (timeIn.value || '09:00').split(':').map(Number);
        const when = new Date(y, (m || 1) - 1, dd || 1, hh || 0, mm || 0);
        if (!title || !dateIn.value || Number.isNaN(when.getTime())) {
          clear(err).append(t('Hãy nhập tên sự kiện và chọn ngày.', 'Please enter a title and choose a date.'));
          (title ? dateIn : titleIn).focus();
          return;
        }
        mine.push({ id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, when, local: true });
        save();
        sel = new Date(when.getFullYear(), when.getMonth(), when.getDate());
        month = new Date(sel.getFullYear(), sel.getMonth(), 1);
        dialog.close();
        refresh(false);
      },
    },
    el('h2', { id: 'ev-h' }, t('Sự kiện mới', 'New event')),
    el('p', { class: 'cal-hint' }, t('Sự kiện được lưu trên thiết bị này, không đồng bộ với Moodle.',
      'Events are saved on this device and are not synced with Moodle.')),
    el('label', { for: 'ev-title' }, t('Tên sự kiện', 'Title')), titleIn,
    el('div', { class: 'cal-row' },
      el('div', {}, el('label', { for: 'ev-date' }, t('Ngày', 'Date')), dateIn),
      el('div', {}, el('label', { for: 'ev-time' }, t('Giờ', 'Time')), timeIn)),
    err,
    el('div', { class: 'cal-actions' },
      el('button', { class: 'btn btn-quiet', type: 'button', onclick: () => dialog.close() }, t('Huỷ', 'Cancel')),
      el('button', { class: 'btn btn-primary', type: 'submit' }, t('Lưu', 'Save')))));

  const newBtn = el('button', {
    class: 'btn btn-quiet cal-new', type: 'button',
    onclick() {
      dateIn.value = dayKey(sel);
      titleIn.value = '';
      clear(err);
      dialog.showModal();   // focus is trapped, Esc closes, focus returns here
      titleIn.focus();
    },
  }, icon('plus', 'btn-ico'), t('Sự kiện mới', 'New event'));

  const cal = el('section', { class: 'panel dash-cal', 'aria-labelledby': 'dash-cal-h' },
    el('div', { class: 'sec-head' }, el('h2', { id: 'dash-cal-h' }, t('Lịch', 'Calendar')), newBtn),
    el('div', { class: 'cal-bar' },
      navBtn(-1, 'Tháng trước', 'Previous month', 'cal-prev'), monthLabel,
      navBtn(1, 'Tháng sau', 'Next month')),
    grid, dayList, saveNote,
    el('p', { class: 'cal-links' },
      ssoLink('/calendar/view.php?view=month', '', t('Lịch đầy đủ', 'Full calendar')),
      ssoLink('/calendar/managesubscriptions.php', '', t('Quản lý theo dõi', 'Manage subscriptions'))),
    dialog);

  const up = el('section', { class: 'panel dash-due', 'aria-labelledby': 'dash-due-h' },
    el('div', { class: 'sec-head' }, el('h2', { id: 'dash-due-h' }, t('Sắp diễn ra', 'Coming Up'))),
    upList);

  refresh(false);
  return [cal, up];
}
