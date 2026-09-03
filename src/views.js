/* ═══════════════════════════════════════════════════════════
   The views. One function per page; each takes the API payload and
   builds real DOM. No template strings holding data, no innerHTML —
   see the note at the top of ui.js for why that is absolute here.
   ═══════════════════════════════════════════════════════════ */

import { el, t, icon, clear, emptyState, formatDate, currentLang } from './ui.js';
import { setDocTitle } from './i18n.js';

/* ── shared pieces ───────────────────────────────────────── */

/** The course tile, used on the dashboard and the courses page. */
function courseTile(c) {
  const tile = el('a', {
    class: 'tile',
    href: `./course.html?id=${encodeURIComponent(c.id)}`,
  });

  const imgWrap = el('div', { class: 'tile-img' });
  if (c.image) {
    /* width/height are set so the tile reserves its space before the
       image arrives — the aspect-ratio box handles layout, but an
       explicit size stops the decode from nudging anything. */
    imgWrap.append(el('img', {
      src: c.image, alt: '', loading: 'lazy', decoding: 'async', width: 480, height: 320,
      onerror(e) { e.target.remove(); },   // a missing cover is not a broken tile
    }));
  }

  const body = el('div', { class: 'tile-body' });

  /* Course titles are bilingual only where the platform actually has both;
     otherwise the one real title is shown in both languages rather than
     inventing a translation. */
  body.append(c.titleEn && c.titleEn !== c.title
    ? el('h3', {}, t(c.title, c.titleEn))
    : el('h3', { text: c.title }));

  /* Below the title, not above it. "EMM231" is the registrar's handle for
     this course, not its name, and leading with it made every tile open on
     a string that means nothing to the person reading it. It is still worth
     showing — learners quote it in email — so it stays as quiet metadata,
     with a word in front of it for anyone listening rather than looking. */
  if (c.code) {
    body.append(el('p', { class: 'tile-code' },
      el('span', { class: 'sr-only' }, t('Mã khoá học: ', 'Course code: ')),
      c.code));
  }

  if (c.summary) {
    body.append(c.summaryVi
      ? el('p', {}, t(c.summaryVi, c.summary))
      : el('p', { text: c.summary }));
  }

  /* The honest progress rule: a bar is only drawn where completion is
     actually tracked. A 0% bar on an untracked course tells the learner
     they have done nothing, which is not what the platform knows. */
  if (c.tracked) {
    const pct = Math.round(c.progress || 0);
    body.append(el('div', { class: 'tile-foot' },
      el('div', {
        class: 'bar', role: 'progressbar',
        'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100,
        'aria-label': currentLang() === 'en' ? 'Course progress' : 'Tiến độ khoá học',
      }, el('i', { dataset: { pct: String(pct) } })),
      el('span', { class: 'bar-pct', text: '0%' }),
    ));
  }

  tile.append(imgWrap, body);
  return tile;
}

function tileGrid(courses) {
  const grid = el('div', { class: 'tiles', 'data-rise': '' });
  courses.forEach(c => grid.append(courseTile(c)));
  return grid;
}

function panel(titleVi, titleEn, ...content) {
  return el('section', { class: 'panel' },
    el('div', { class: 'sec-head' }, el('h2', {}, t(titleVi, titleEn))),
    ...content);
}

/* ── dashboard ───────────────────────────────────────────── */

export function renderDashboard(d, host) {
  const main = el('div');

  main.append(d.recent.length
    ? panel('Khoá học gần đây', 'Recently accessed courses', tileGrid(d.recent))
    : panel('Khoá học gần đây', 'Recently accessed courses',
        emptyState('Bạn chưa mở khoá học nào.', "You haven't opened a course yet.",
          el('a', { class: 'btn btn-primary', href: './courses.html' },
            t('Xem khoá học', 'Browse courses')))));

  main.append(upcoming(d.events));

  const rail = el('aside', { class: 'rail' });

  const list = el('ul', { class: 'rail-list' });
  d.courses.slice(0, 6).forEach(c => list.append(
    el('li', {}, el('a', { href: `./course.html?id=${encodeURIComponent(c.id)}` },
      el('span', { class: 'pip' }), el('span', { text: c.title })))));
  list.append(el('li', {}, el('a', { href: './courses.html' },
    el('span', { class: 'pip on' }), t('Tất cả khoá học', 'All courses'))));
  rail.append(panel('Khoá học của tôi', 'My courses', list));

  host.append(main, rail);
}

/* The calendar the prototype drew was a hardcoded August 2026 grid — a
   picture of a calendar. What a learner actually needs from a dashboard
   is the next few things they have to turn up to, so this is a list of
   real events, and it says so plainly when there are none. */
function upcoming(events) {
  if (!events.length) {
    return panel('Sắp tới', 'Coming up',
      emptyState('Không có buổi học nào sắp tới.', 'Nothing scheduled coming up.'));
  }

  const list = el('ul', { class: 'events' });
  for (const e of events) {
    const when = new Date(e.when);
    const item = el('li', { class: 'event' },
      el('time', {
        class: 'event-date', datetime: e.when,
      },
        el('span', { class: 'event-day', text: formatDate(e.when, { day: 'numeric' }) }),
        el('span', { class: 'event-mon', text: formatDate(e.when, { month: 'short' }) }),
      ),
      el('div', { class: 'event-main' },
        e.href
          ? el('a', { href: e.href, text: e.title })
          : el('span', { class: 'event-title', text: e.title }),
        el('span', {
          class: 'event-meta',
          text: [e.courseTitle, formatDate(e.when, { hour: '2-digit', minute: '2-digit' })]
            .filter(Boolean).join(' · '),
        }),
      ));
    if (when - Date.now() < 86_400_000) item.classList.add('is-soon');
    list.append(item);
  }
  return panel('Sắp tới', 'Coming up', list);
}

/* ── courses ─────────────────────────────────────────────── */

export function renderCourses(d, host) {
  if (!d.groups.length) {
    host.append(emptyState(
      'Bạn chưa được ghi danh vào khoá học nào.',
      "You aren't enrolled in any courses yet.",
    ));
    return;
  }
  for (const g of d.groups) {
    host.append(panel(g.title, g.title, tileGrid(g.courses)));
  }
}

/* ── one course ──────────────────────────────────────────── */

export function renderCourse(d, host) {
  const { course, sections } = d;

  /* Through i18n rather than straight onto document.title: the tab has to
     keep saying the course name after a language toggle, and apply() rewrites
     the title from <html data-title-*> every time it runs. */
  setDocTitle(`${course.title} | GLOW`, `${course.title} | GLOW`);

  /* The breadcrumb and page heading are part of the shell, so the view
     fills them rather than the shell guessing at load time. Both drop
     data-i18n on the way in — a real course name is not one of our two
     translations, and leaving the attribute on means the next refresh()
     puts the placeholder back. */
  const h1 = document.querySelector('.pagehead h1');
  if (h1) { h1.textContent = course.title; h1.removeAttribute('data-i18n'); }
  /* The summary belongs in one place. It was appearing both under the
     title and again in the "About this course" panel, which is the kind
     of duplication that makes a page feel auto-generated. It stays in the
     panel, where the progress bar gives it context. */
  document.querySelector('.pagehead p')?.remove();
  const crumbNow = document.querySelector('.crumbs .crumb-now');
  if (crumbNow) { crumbNow.textContent = course.title; crumbNow.removeAttribute('data-i18n'); }

  const hero = el('div', { class: 'course-hero', 'data-rise': '' });
  const heroText = el('div', {});

  /* Only head the panel "About this course" when there is actually a
     description to read. GLOW publishes a summary for some courses and
     not others; an "About" heading over an empty paragraph reads as a
     page that failed to load rather than as a course without a blurb. */
  if (course.summary) {
    heroText.append(
      el('div', { class: 'sec-head' }, el('h2', {}, t('Về khoá học', 'About this course'))),
      el('p', { class: 'body', text: course.summary }));
  } else if (course.category) {
    heroText.append(el('div', { class: 'sec-head' }, el('h2', { text: course.category })));
  }

  if (course.tracked) {
    const pct = Math.round(course.progress || 0);
    heroText.append(el('div', { class: 'tile-foot course-progress' },
      el('div', {
        class: 'bar', role: 'progressbar',
        'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100,
        'aria-label': currentLang() === 'en' ? 'Course progress' : 'Tiến độ khoá học',
      }, el('i', { dataset: { pct: String(pct) } })),
      el('span', { class: 'bar-pct', text: '0%' })));
  }
  /* The bridge into the platform. /api/sso mints a one-time login and
     redirects, so the learner arrives already signed in — which is the
     whole reason quizzes, assignments and the ETOP scheduler were left
     in Moodle rather than rebuilt. A plain <a> and not a fetch: it is a
     navigation, and it has to survive leaving this origin. */
  if (course.moodlePath) {
    heroText.append(el('p', { class: 'tile-foot' },
      el('a', {
        class: 'btn btn-quiet',
        href: `/api/sso?to=${encodeURIComponent(course.moodlePath)}`,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      t('Mở trong Moodle', 'Open in Moodle'),
      el('span', { class: 'sr-only' }, t(' (mở tab mới)', ' (opens in a new tab)')))));
  }

  hero.append(heroText);
  if (course.image) {
    hero.append(el('img', { src: course.image, alt: '', width: 640, height: 427, decoding: 'async' }));
  }
  host.append(el('section', { class: 'panel' }, hero));

  if (!sections.length) {
    /* Two different things look identical if you let them: a course that
       is genuinely empty, and one whose material this site has simply
       never had access to. Saying "no content yet" about the second would
       tell a learner their course is empty when it is not. */
    host.append(course.contentInMoodle
      /* The button sits directly above, so this states the fact rather than
         repeating the instruction and its label a second time. */
      ? emptyState(
        'Nội dung khoá học này nằm trên nền tảng GLOW.',
        'This course’s material lives on the GLOW platform.')
      : emptyState('Khoá học này chưa có nội dung.', 'This course has no content yet.'));
    return;
  }

  for (const s of sections) {
    const block = el('section', { class: 'section-block' });
    block.append(el('div', { class: 'section-head' },
      el('h3', { text: s.title }),
      el('span', { class: 'section-count', text: String(s.activities.length) })));

    if (s.summary) block.append(el('p', { class: 'section-summary', text: s.summary }));

    const ul = el('ul', { class: 'acts' });
    s.activities.forEach(a => ul.append(activityRow(a)));
    block.append(ul);
    host.append(block);
  }
}

function activityRow(a) {
  const row = el('li', { class: 'act' });
  row.append(el('span', { class: 'act-ico' }, icon(a.type)));

  const main = el('span', { class: 'act-main' });

  if (a.href) {
    const link = el('a', { href: a.href, text: a.title });
    /* Anything leaving for Moodle or a third party opens in a new tab and
       says so, rather than silently replacing the page the learner is
       working through. rel is not optional on a target=_blank link:
       without noopener the destination gets a handle on this window. */
    if (a.external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(el('span', { class: 'sr-only' },
        t(' (mở tab mới)', ' (opens in a new tab)')));
    }
    main.append(link);
  } else {
    /* The rule the whole rebuild turns on: no link to nowhere. An activity
       with no destination is rendered as plainly unavailable, so the
       learner can tell "not ready yet" from "broken". */
    main.append(el('span', { class: 'act-title is-unavailable', text: a.title }));
    row.classList.add('act-unavailable');
  }

  const meta = el('span', { class: 'act-type' });
  meta.append(a.typeLabel);
  if (!a.href) meta.append(' · ', t('chưa có', 'not available yet'));
  if (a.due) meta.append(' · ', t(`hạn ${formatDate(a.due)}`, `due ${formatDate(a.due)}`));
  main.append(meta);
  row.append(main);

  if (a.completion !== 'none') {
    const done = a.completion === 'done';
    row.append(el('span', {
      class: `act-done${done ? ' on' : ''}`,
      text: done ? '✓' : '—',
      'aria-label': done
        ? (currentLang() === 'en' ? 'Completed' : 'Đã hoàn thành')
        : (currentLang() === 'en' ? 'Not completed' : 'Chưa hoàn thành'),
      role: 'img',
    }));
  }

  return row;
}

/* ── english / resources catalogues ──────────────────────── */

export function renderCatalog(d, host) {
  if (!d.groups.length) {
    host.append(emptyState('Chưa có nội dung.', 'Nothing here yet.'));
    return;
  }

  for (const g of d.groups) {
    const items = g.items.map(i => (typeof i === 'string' ? { title: i } : i));

    const track = el('section', { class: 'track', 'data-rise': '' });
    track.append(el('div', { class: 'track-head' },
      el('h3', {}, g.titleVi ? t(g.titleVi, g.title) : document.createTextNode(g.title)),
      el('span', { class: 'count', text: String(items.length) })));

    const chips = el('div', { class: 'chips' });
    for (const item of items) {
      chips.append(item.courseId
        ? el('a', { class: 'chip', href: `./course.html?id=${encodeURIComponent(item.courseId)}`, text: item.title })
        /* No course behind it yet — same honesty rule as the activity rows. */
        : el('span', { class: 'chip is-unavailable', text: item.title, title: currentLang() === 'en' ? 'Not available yet' : 'Chưa có' }));
    }
    track.append(chips);
    host.append(track);
  }
}
