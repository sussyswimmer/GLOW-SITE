/* ═══════════════════════════════════════════════════════════
   The views. One function per page; each takes the API payload and
   builds real DOM. No template strings holding data, no innerHTML —
   see the note at the top of ui.js for why that is absolute here.
   ═══════════════════════════════════════════════════════════ */

import { el, t, icon, clear, emptyState, formatDate, currentLang, bilingual, region } from './ui.js';
import { api } from './api.js';
import { setDocTitle } from './i18n.js';

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

  renderSections(sections, host);
}

/* The sections and activities of a course. Shared with the public course
   page (src/views/catalogue.js), which reaches the same interiors by code. */
export function renderSections(sections, host) {
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
      const name = item.titleVi ? t(item.titleVi, item.title) : item.title;
      chips.append(item.emmai
        ? el('button', { class: 'chip', type: 'button', 'data-emmai-open': '' }, name)
        : item.href
        ? el('a', { class: 'chip', href: item.href, target: '_blank', rel: 'noopener noreferrer' }, name,
            el('span', { class: 'sr-only' }, t(' (mở tab mới)', ' (opens in a new tab)')))
        : item.courseId
        ? el('a', { class: 'chip', href: item.code ? `./course.html?code=${encodeURIComponent(item.code)}` : `./course.html?id=${encodeURIComponent(item.courseId)}` }, name)
        /* No course behind it yet — same honesty rule as the activity rows. */
        : el('span', { class: 'chip is-unavailable', text: item.title, title: currentLang() === 'en' ? 'Not available yet' : 'Chưa có' }));
    }
    track.append(chips);
    host.append(track);
  }
}

/* ── payment ─────────────────────────────────────────────────
   Four things, in the order a learner needs them: where they stand, what
   the tuition is, how to pay — with "can't afford it?" given the same
   weight right beside it — and what they have paid before.

   The page is public. Signed out, the payload comes from /api/tuition and
   has no status: tuition leads, the status card becomes a sign-in prompt,
   there is no history, and the help links go straight to Moodle because
   /api/sso needs a session to sign anyone in.

   Two rules hold the page honest while the details are still being
   decided. A tuition amount that has not been set reads "to be announced",
   never a number and never "free". And with no payment provider connected
   the pay button is visibly disabled and says why, rather than leading
   somewhere that cannot take money. */

const STATUS = {
  unknown:        { vi: 'Chưa có thông tin', en: 'No details yet', ico: 'wallet', tone: '' },
  unpaid:         { vi: 'Chưa thanh toán', en: 'Not paid yet', ico: 'wallet', tone: 'due' },
  pending:        { vi: 'Đang chờ xác nhận', en: 'Awaiting confirmation', ico: 'other', tone: '' },
  paid:           { vi: 'Đã thanh toán', en: 'Paid', ico: 'check', tone: 'ok' },
  'aid-review':   { vi: 'Đang xét hỗ trợ học phí', en: 'Fee support under review', ico: 'other', tone: '' },
  'aid-approved': { vi: 'Được hỗ trợ học phí', en: 'Fee support approved', ico: 'check', tone: 'ok' },
};

/* Words and an icon, never colour alone. */
export function statusPill(status) {
  const s = STATUS[status] || STATUS.unknown;
  return el('span', { class: `pill pill-lg${s.tone ? ` pill-${s.tone}` : ''}` }, icon(s.ico), t(s.vi, s.en));
}

export function statusHint(b) {
  const long = { day: 'numeric', month: 'long', year: 'numeric' };
  switch (b.status) {
    case 'unpaid': return t('Xem cách thanh toán học phí, hoặc xin hỗ trợ học phí nếu bạn cần.',
      'See how to pay your tuition, or ask for fee support if you need it.');
    case 'pending': return t('Chúng tôi đang xác nhận khoản thanh toán của bạn. Bạn không cần thanh toán lại.',
      "We're confirming your payment. You don't need to pay again.");
    case 'paid': return b.paidThrough
      ? t(`Học phí của bạn đã được thanh toán đến ${formatDate(b.paidThrough, long)}.`,
          `Your tuition is paid through ${formatDate(b.paidThrough, long)}.`)
      : t('Học phí của bạn đã được thanh toán.', 'Your tuition is paid.');
    case 'aid-review': return t('Yêu cầu hỗ trợ học phí của bạn đang được xem xét.', 'Your request for fee support is being reviewed.');
    case 'aid-approved': return t('Yêu cầu hỗ trợ học phí của bạn đã được chấp thuận.', 'Your request for fee support has been approved.');
    default: return t('Trạng thái thanh toán của bạn sẽ hiện ở đây khi GLOW mở thanh toán trực tuyến.',
      'Your payment status will show here once GLOW opens online payment.');
  }
}

function money(amount, currency, lang) {
  try {
    return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'vi-VN',
      { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/* Through the SSO bridge when signed in, so the learner arrives at Moodle
   signed in; straight to Moodle otherwise (`origin` is only sent then). */
function moodleLink(origin, path, cls, ...label) {
  return el('a', {
    class: cls,
    href: origin ? new URL(path, origin).href : `/api/sso?to=${encodeURIComponent(path)}`,
    target: '_blank',
    rel: 'noopener noreferrer',
  }, ...label, el('span', { class: 'sr-only' }, t(' (mở tab mới)', ' (opens in a new tab)')));
}

export function renderPayment(b, host) {
  const tbd = () => el('span', { class: 'tbd' }, t('Đang cập nhật', 'To be announced'));
  const { tuition } = b;
  const signedIn = b.status != null;
  const origin = signedIn ? null : b.moodleOrigin;

  /* 1 · where they stand — or, signed out, how to find out */
  const status = el('section', { class: 'panel pay-status', 'aria-labelledby': 'pay-status-h' },
    el('div', { class: 'sec-head' }, el('h2', { id: 'pay-status-h' }, t('Trạng thái của bạn', 'Your status'))));
  if (signedIn) {
    status.append(statusPill(b.status), el('p', { class: 'pay-hint' }, statusHint(b)));
  } else {
    status.append(
      el('p', { class: 'pay-hint' }, t('Đăng nhập để xem trạng thái thanh toán và lịch sử thanh toán của bạn.',
        'Sign in to see your payment status and payment history.')),
      el('a', { class: 'btn btn-quiet', href: './login.html?next=payment.html' }, t('Đăng nhập', 'Sign in')));
  }

  /* 2 · what it costs and what it covers */
  const amount = tuition.amount == null
    ? tbd()
    : t(money(tuition.amount, tuition.currency, 'vi'), money(tuition.amount, tuition.currency, 'en'));
  const term = tuition.termVi || tuition.termEn
    ? t(tuition.termVi || tuition.termEn, tuition.termEn || tuition.termVi)
    : tbd();

  const includes = el('ul', { class: 'pay-includes' });
  tuition.includes.forEach(i => includes.append(el('li', {}, icon('check'), t(i.vi, i.en))));

  const tuitionCard = el('section', { class: 'panel pay-tuition', 'aria-labelledby': 'pay-tuition-h' },
    el('div', { class: 'sec-head' }, el('h2', { id: 'pay-tuition-h' }, t('Học phí', 'Tuition'))),
    el('dl', { class: 'pay-facts' },
      el('div', {}, el('dt', {}, t('Số tiền', 'Amount')), el('dd', { class: 'pay-amount' }, amount)),
      el('div', {}, el('dt', {}, t('Áp dụng cho', 'Covers')), el('dd', {}, term))),
    tuition.amount == null
      ? el('p', { class: 'pay-note' }, t('Pacific Links Foundation sẽ công bố học phí trước khi mở thanh toán.',
          'Pacific Links Foundation will announce the tuition before payment opens.'))
      : null,
    el('h3', { class: 'pay-sub' }, t('Học phí bao gồm', "What's included")),
    tuition.includes.length ? includes : el('p', {}, tbd()));

  /* A visitor came for the price; a learner came for their status. */
  host.append(...(signedIn ? [status, tuitionCard] : [tuitionCard, status]));

  /* 3 · how to pay, and — beside it, at the same weight — what to do if
     they can't. For the young people GLOW serves, the second is not a
     footnote. */
  const how = el('div', { class: 'pay-how' },
    el('h3', { class: 'pay-sub' }, t('Cách thanh toán', 'How to pay')));
  if (!b.provider) {
    how.append(
      el('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true, 'aria-describedby': 'pay-soon' },
        t('Thanh toán trực tuyến — sắp có', 'Online payment — coming soon')),
      el('p', { class: 'pay-hint', id: 'pay-soon' },
        t('GLOW chưa mở thanh toán, nên hiện tại bạn chưa cần trả gì. Khi mở, cách thanh toán sẽ hiện ngay trên trang này.',
          "GLOW hasn't opened payment yet, so there is nothing to pay right now. When it opens, how to pay will appear on this page.")),
      moodleLink(origin, b.contact.payPath, 'btn btn-quiet btn-block', t('Câu hỏi về học phí?', 'Questions about tuition?')));
  }

  const aid = el('div', { class: 'pay-aid' },
    el('p', { class: 'dash-kick' }, t('Hỗ trợ học phí', 'Fee support')),
    el('h3', {}, t('Học phí là một trở ngại?', 'Is the fee a barrier?')),
    el('p', {}, t('Hãy cho chúng tôi biết hoàn cảnh của bạn. Pacific Links Foundation xem xét từng yêu cầu hỗ trợ học phí.',
      'Tell us about your situation. Pacific Links Foundation considers every request for fee support.')),
    moodleLink(origin, b.contact.aidPath, 'btn btn-primary btn-block', t('Xin hỗ trợ học phí', 'Ask for fee support')));

  host.append(el('section', { class: 'panel pay-wide pay-pay', 'aria-labelledby': 'pay-pay-h' },
    el('div', { class: 'sec-head' }, el('h2', { id: 'pay-pay-h' }, t('Thanh toán học phí', 'Paying your tuition'))),
    el('div', { class: 'pay-split' }, how, aid)));

  /* 4 · what they have paid before — theirs alone, so signed in only */
  if (signedIn) host.append(paymentHistory(b.history));

  /* What we hold and what we never will. */
  host.append(el('p', { class: 'pay-wide pay-trust' }, icon('shield'),
    el('span', {}, t('Trang web GLOW không lưu số thẻ hay thông tin tài khoản ngân hàng của bạn. Khi GLOW mở thanh toán trực tuyến, khoản thanh toán sẽ được xử lý qua một đơn vị thanh toán bên ngoài.',
      'This site never stores your card number or bank details. When GLOW opens online payment, payments will be processed by a separate payment provider.'))));
}

function paymentHistory(history) {
  const hist = el('section', { class: 'panel pay-wide', 'aria-labelledby': 'pay-hist-h' },
    el('div', { class: 'sec-head' }, el('h2', { id: 'pay-hist-h' }, t('Lịch sử thanh toán', 'Payment history'))));
  if (!history.length) {
    hist.append(emptyState('Chưa có khoản thanh toán nào.', 'No payments yet.'));
  } else {
    const row = (...cells) => el('tr', {}, ...cells);
    const table = el('table', { class: 'pay-table' },
      el('caption', { class: 'sr-only' }, t('Các khoản thanh toán trước đây', 'Your past payments')),
      el('thead', {}, row(
        el('th', { scope: 'col' }, t('Ngày', 'Date')),
        el('th', { scope: 'col' }, t('Số tiền', 'Amount')),
        el('th', { scope: 'col' }, t('Hình thức', 'Method')),
        el('th', { scope: 'col' }, t('Trạng thái', 'Status')),
        el('th', { scope: 'col' }, t('Mã tham chiếu', 'Reference')))));
    const body = el('tbody');
    for (const p of history) {
      body.append(row(
        el('td', { text: formatDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' }) }),
        el('td', {}, t(money(p.amount, p.currency, 'vi'), money(p.amount, p.currency, 'en'))),
        el('td', { text: p.method }),
        el('td', { text: p.status }),
        el('td', { class: 'pay-ref', text: p.reference })));
    }
    table.append(body);
    hist.append(el('div', { class: 'pay-table-wrap' }, table));
  }
  return hist;
}
