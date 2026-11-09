/* ═══════════════════════════════════════════════════════════
   The catalogue pages: all courses, the English and Skills pages, the
   staff-only Training page, and one course by code.

   tools/build-pages.mjs writes the PUBLIC half of these pages into the
   HTML with the same class names and the same element shape as below, so
   this file replaces like with like and nothing jumps. What the build
   cannot know — the viewer's role and progress — arrives from
   /api/catalogue and is already filtered: a course the viewer may not
   see is not in the payload, so there is nothing here to hide.
   ═══════════════════════════════════════════════════════════ */

import { el, t, bilingual, clear, emptyState, currentLang } from '../ui.js';
import { setDocTitle } from '../i18n.js';
import { api } from '../api.js';
import { renderSections } from '../views.js';

/* Diacritic-insensitive: "dac nhan tam" finds "Đắc Nhân tâm". NFD splits a
   letter from its marks; đ has no decomposition, so it is mapped by hand. */
export const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[đĐ]/g, 'd').toLowerCase();

const ACCESS_LABEL = {
  gems: ['Học bổng GEMS', 'GEMS scholars'],
  seeds: ['Học bổng SEEDS', 'SEEDS scholars'],
  staff: ['Nhân viên', 'Staff'],
};

/* A name that exists in one language only is shown as itself in both, not
   as a translation nobody wrote. */
const bi = (vi, en) => (vi && vi !== en ? t(vi, en) : document.createTextNode(en));
const nameIn = (c, lang) => (lang === 'en' ? c.en : c.vi || c.en);
const byKey = list => Object.fromEntries(list.map(x => [x.key, x]));

function accessBadge(access) {
  const a = ACCESS_LABEL[access];
  return a ? el('span', { class: 'cbadge' }, t(a[0], a[1])) : null;
}

function progressBar(pct) {
  pct = Math.round(pct);
  /* data-run: app.js's meters() animates bars it has not seen; a page of a
     hundred cards is not the place for that, so these are drawn as they are. */
  return el('span', { class: 'tile-foot' },
    el('span', {
      class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100,
      'aria-label': currentLang() === 'en' ? 'Course progress' : 'Tiến độ khoá học',
    }, el('i', { 'data-run': '1', style: `width:${pct}%` })),
    el('span', { class: 'bar-pct', text: pct + '%' }));
}

/** The one course card. Whole card is the link. */
export function courseCard(c, cat) {
  const card = el('a', { class: 'ccard', href: `./course.html?code=${encodeURIComponent(c.code)}` },
    el('span', { class: 'ccard-name' }, bi(c.vi, c.en)),
    el('span', { class: 'ccard-top' },
      el('span', { class: 'ccode' }, el('span', { class: 'sr-only' }, t('Mã khoá học: ', 'Course code: ')), c.code),
      accessBadge(c.access)),
    el('span', { class: 'ccard-cat' }, t(cat.vi, cat.en)));
  if (typeof c.progress === 'number') card.append(progressBar(c.progress));
  return card;
}

const cardGrid = (courses, cats) => el('div', { class: 'cgrid' }, courses.map(c => courseCard(c, cats[c.cat])));

/* ── courses.html ──────────────────────────────────────────── */

export function renderCourses(d, host) {
  const cats = byKey(d.categories);
  const state = { q: new URLSearchParams(location.search).get('q') || '', sort: 'default', cat: 'all' };

  const catCards = el('div', { class: 'catcards' }, d.categories.map(c => {
    const n = d.courses.filter(x => x.cat === c.key).length;
    return el('a', { class: 'catcard', href: `./${c.page}` },
      el('span', { class: 'catcard-name' }, t(c.vi, c.en)),
      el('span', { class: 'catcard-blurb' }, t(c.blurbVi, c.blurbEn)),
      el('span', { class: 'catcard-n' }, t(`${n} khoá học`, `${n} ${n === 1 ? "course" : "courses"}`)));
  }));

  const input = el('input', { id: 'cq', type: 'search', name: 'q', autocomplete: 'off', value: state.q });
  const sort = el('select', { id: 'csort' },
    el('option', { value: 'default' }, currentLang() === 'en' ? 'Default order' : 'Thứ tự mặc định'),
    el('option', { value: 'az' }, currentLang() === 'en' ? 'Name A–Z' : 'Tên A–Z'));
  const tabs = el('div', { class: 'ctabs', role: 'group', 'aria-label': currentLang() === 'en' ? 'Filter by category' : 'Lọc theo danh mục' });
  const status = el('p', { class: 'cstatus', role: 'status', 'aria-live': 'polite' });
  const results = el('div', { class: 'cresults' });

  const matches = () => {
    const q = fold(state.q.trim());
    return d.courses.filter(c => !q || fold(`${c.en} ${c.vi} ${c.code}`).includes(q));
  };

  function paint() {
    const hits = matches();

    clear(tabs);
    [{ key: 'all', vi: 'Tất cả', en: 'All' }, ...d.categories].forEach(c => {
      const n = c.key === 'all' ? hits.length : hits.filter(x => x.cat === c.key).length;
      tabs.append(el('button', {
        type: 'button', class: 'chip ctab', 'aria-pressed': String(state.cat === c.key),
        onclick() { state.cat = c.key; paint(); },
      }, t(c.vi, c.en), el('span', { class: 'ctab-n', text: String(n) })));
    });

    let shown = state.cat === 'all' ? hits : hits.filter(c => c.cat === state.cat);
    clear(results);
    clear(status);

    if (!shown.length) {
      results.append(emptyState(`Không có khoá học nào khớp với “${state.q}”`, `No courses match “${state.q}”`));
      return;
    }
    status.append(t(`${shown.length} khoá học`, `${shown.length} ${shown.length === 1 ? "course" : "courses"}`));

    /* Grouped by category while browsing; flat the moment someone searches
       or sorts, because then the order is the answer. */
    if (!state.q.trim() && state.sort === 'default') {
      d.categories.filter(c => state.cat === 'all' || state.cat === c.key).forEach(c => {
        const list = shown.filter(x => x.cat === c.key);
        if (!list.length) return;
        results.append(el('section', { class: 'cgroup-block' },
          el('div', { class: 'sec-head' }, el('h2', {}, t(c.vi, c.en)), el('span', { class: 'count', text: String(list.length) })),
          cardGrid(list, cats)));
      });
      return;
    }
    if (state.sort === 'az') {
      const lang = currentLang();
      shown = [...shown].sort((a, b) => nameIn(a, lang).localeCompare(nameIn(b, lang), lang === 'en' ? 'en' : 'vi'));
    }
    results.append(cardGrid(shown, cats));
  }

  input.addEventListener('input', () => { state.q = input.value; paint(); });
  sort.addEventListener('change', () => { state.sort = sort.value; paint(); });

  const controls = el('div', { class: 'cctl' },
    el('div', { class: 'cfield' },
      el('label', { for: 'cq' }, t('Tìm khoá học (tên tiếng Anh hoặc tiếng Việt)', 'Search courses (English or Vietnamese names)')), input),
    el('div', { class: 'cfield cfield-sort' }, el('label', { for: 'csort' }, t('Sắp xếp', 'Sort by')), sort));

  host.append(catCards, controls, tabs, status, results);
  paint();
}

/* ── english.html, skills.html, training.html ───────────────── */

function subSection(sub, courses, groups, cats) {
  const sec = el('section', { class: 'catsec', id: sub.key },
    el('div', { class: 'catsec-head' },
      el('h2', {}, t(sub.vi, sub.en)), el('span', { class: 'count', text: String(courses.length) })));
  if (sub.descVi || sub.descEn) sec.append(el('p', { class: 'catsec-desc' }, t(sub.descVi || sub.descEn, sub.descEn || sub.descVi)));

  /* English through the news is a feature of this sub-category, not a course. */
  if (sub.key === 'english-self-learning') {
    sec.append(el('a', { class: 'feature', href: './lessons.html' },
      el('span', { class: 'feature-title' }, t('Bài học tiếng Anh qua tin tức', 'English through the news')),
      el('span', { class: 'feature-desc' }, t('Bài đọc mỗi ngày có audio, từ khoá và sổ từ vựng.', 'Daily lessons with audio, keywords and a word bank.')),
      el('span', { class: 'feature-go' }, t('Đọc bài học', 'Read the lessons'), ' →')));
  }

  const loose = courses.filter(c => !c.group);
  if (loose.length) sec.append(cardGrid(loose, cats));
  groups.filter(g => g.sub === sub.key).forEach(g => {
    const list = courses.filter(c => c.group === g.key);
    if (!list.length) return;
    sec.append(el('div', { class: 'cgroup' }, el('h3', { class: 'cgroup-title' }, t(g.vi, g.en)), cardGrid(list, cats)));
  });
  return sec;
}

export function renderCategoryPage(catKey) {
  return (d, host) => {
    /* The static markup of training.html is the non-staff panel; only the
       server's role decides whether it is replaced. */
    if (catKey === 'training' && d.role !== 'staff') return;
    const cats = byKey(d.categories);
    d.subcategories.filter(s => s.cat === catKey).forEach(s => {
      const courses = d.courses.filter(c => c.sub === s.key);
      if (courses.length) host.append(subSection(s, courses, d.groups, cats));
    });
    if (!host.children.length) host.append(emptyState('Chưa có khoá học.', 'No courses yet.'));
  };
}

/* ── course.html?code= ─────────────────────────────────────── */

const link = (href, vi, en) => el('a', { href }, t(vi, en));

/* The course payload names its category and sub-category by key only; the
   names for the breadcrumb come from the catalogue. If that fetch fails the
   crumbs simply stop at Courses. */
export async function loadCourse(code) {
  const [d, cat] = await Promise.all([api.catalogueCourse(code), api.catalogue().catch(() => null)]);
  if (cat) {
    d.trail = {
      cat: cat.categories.find(x => x.key === d.course.cat),
      sub: cat.subcategories.find(x => x.key === d.course.sub),
    };
  }
  return d;
}

export function renderCatalogueCourse(d, host) {
  const { course: c, sections } = d;

  setDocTitle(`${c.vi || c.en} | GLOW`, `${c.en} | GLOW`);

  /* The breadcrumb and heading belong to the shell, so the view fills them
     (see renderCourse in views.js). */
  const h1 = document.querySelector('.pagehead h1');
  if (h1) bilingual(h1, c.vi || c.en, c.en);
  const head = document.querySelector('.pagehead-in');
  head?.querySelector('p')?.remove();
  if (head && c.vi && c.vi !== c.en) head.append(bilingual(el('p', { class: 'course-alt' }), c.en, c.vi));

  const crumbs = document.querySelector('.crumbs');
  const trail = d.trail?.cat && d.trail?.sub ? d.trail : null;
  if (crumbs) {
    const sep = () => el('span', { 'aria-hidden': 'true' }, '/');
    clear(crumbs).append(
      link('./index.html', 'Trang chủ', 'Home'), sep(),
      link('./courses.html', 'Khoá học', 'Courses'), sep(),
      ...(trail ? [link(`./${trail.cat.page}`, trail.cat.vi, trail.cat.en), sep(),
        link(`./${trail.cat.page}#${trail.sub.key}`, trail.sub.vi, trail.sub.en), sep()] : []),
      bilingual(el('span', { class: 'crumb-now' }), c.vi || c.en, c.en));
  }

  const meta = el('div', { class: 'cmeta' },
    el('span', { class: 'ccode' }, el('span', { class: 'sr-only' }, t('Mã khoá học: ', 'Course code: ')), c.code),
    accessBadge(c.access));
  if (c.presenter) meta.append(el('span', { class: 'cpresenter' }, t('Người trình bày: ', 'Presenter: '), c.presenter));
  const panel = el('section', { class: 'panel', 'data-rise': '' }, meta);
  if (typeof c.progress === 'number') panel.append(el('div', { class: 'course-progress' }, progressBar(c.progress)));
  host.append(panel);

  if (sections.length) {
    renderSections(sections, host);
    return;
  }

  /* Signed in, the bridge mints a one-time login; signed out there is no
     session to sign anyone in with, so it is the plain platform address. */
  const open = c.moodlePath && el('a', {
    class: 'btn btn-quiet',
    href: d.role ? `/api/sso?to=${encodeURIComponent(c.moodlePath)}` : `https://glow.mata9.com${c.moodlePath}`,
    target: '_blank', rel: 'noopener noreferrer',
  }, t('Mở trên nền tảng GLOW', 'Open on the GLOW platform'),
  el('span', { class: 'sr-only' }, t(' (mở tab mới)', ' (opens in a new tab)')));
  host.append(emptyState('Nội dung khoá học này sẽ được cập nhật sau.', 'This content will be filled later.', open || undefined));
}
