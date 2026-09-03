/* ═══════════════════════════════════════════════════════════
   Sign in.

   The one page a learner sees before they are anyone, so it does the
   smallest possible amount: takes two fields, hands them to the server,
   and says clearly what happened. No animation that delays the form
   being usable, no data fetched before there is a session to fetch it
   with.
   ═══════════════════════════════════════════════════════════ */

import { initI18n } from './i18n.js';
import { api, ApiError } from './api.js';
import { el, t } from './ui.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

initI18n({ reduced });

const form = document.getElementById('loginForm');
const userField = document.getElementById('username');
const passField = document.getElementById('password');
const submit = document.getElementById('loginSubmit');
const errorBox = document.getElementById('loginError');
const params = new URLSearchParams(location.search);

/* ── where to go afterwards ──────────────────────────────
   `next` comes from the URL, so it is attacker-controlled and cannot be
   trusted as a redirect target: a link to our own login page that bounces
   to somebody else's site is a credible phishing hop. Only a known page
   of this app is accepted; anything else silently becomes the dashboard. */
const ALLOWED_NEXT = new Set([
  'dashboard.html', 'courses.html', 'course.html', 'english.html', 'resources.html',
]);

function destination() {
  const raw = params.get('next') || '';
  const [file, query = ''] = raw.split('?');
  if (!ALLOWED_NEXT.has(file)) return './dashboard.html';
  /* The query string is preserved so a deep link to a specific course
     survives the sign-in, but only after the filename has been vouched
     for and with the query re-encoded rather than passed through. */
  const safeQuery = new URLSearchParams(query).toString();
  return `./${file}${safeQuery ? `?${safeQuery}` : ''}`;
}

/* If they arrive already signed in, don't make them do it again. */
api.me()
  .then(() => { location.replace(destination()); })
  .catch(() => { /* not signed in, which is the normal case here */ });

/* ── the reason they were sent here ──────────────────────── */
const REASONS = {
  /* Only sent when a page had already rendered signed in and the session
     then lapsed under them. */
  expired: [
    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    'Your session expired. Please sign in again.',
  ],
  /* Sent when there was no session to begin with — someone following a nav
     item or a course link straight into the platform. Says what is behind
     the door rather than implying they lost something they never had. */
  required: [
    'Đăng nhập để mở khoá học của bạn.',
    'Sign in to open your courses.',
  ],
};

const reason = REASONS[params.get('reason')];
if (reason) showNotice(...reason);

function showNotice(vi, en) {
  errorBox.classList.remove('is-error');
  errorBox.classList.add('is-notice', 'is-shown');
  errorBox.replaceChildren(t(vi, en));
}

function showError(vi, en) {
  errorBox.classList.remove('is-notice');
  errorBox.classList.add('is-error', 'is-shown');
  errorBox.replaceChildren(t(vi, en));
  /* role="alert" on the container announces this to a screen reader the
     moment it changes; moving focus to the first field lets a keyboard
     user correct the mistake without hunting for where they were. */
  userField.focus();
}

function clearError() {
  errorBox.classList.remove('is-shown', 'is-error', 'is-notice');
  errorBox.replaceChildren();
}

let busy = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;

  const username = userField.value.trim();
  const password = passField.value;

  if (!username || !password) {
    showError('Nhập tên đăng nhập và mật khẩu.', 'Enter your username and password.');
    return;
  }

  busy = true;
  submit.disabled = true;
  submit.classList.add('is-busy');
  clearError();

  try {
    await api.login({ username, password });
    /* Cleared the moment it is no longer needed, so the password is not
       sitting in a DOM node for the life of the tab. */
    passField.value = '';
    location.replace(destination());
  } catch (err) {
    const kind = err instanceof ApiError ? err.kind : 'server';
    if (err?.code === 'too_many_attempts') {
      showError(
        'Quá nhiều lần thử. Vui lòng đợi vài phút rồi thử lại.',
        'Too many attempts. Please wait a few minutes and try again.',
      );
    } else if (kind === 'offline') {
      showError('Bạn đang ngoại tuyến. Kiểm tra kết nối mạng.', 'You are offline. Check your connection.');
    } else if (kind === 'timeout') {
      showError('Máy chủ phản hồi quá chậm. Thử lại.', 'The server took too long. Please try again.');
    } else if (kind === 'auth') {
      showError('Tên đăng nhập hoặc mật khẩu không đúng.', "That username and password didn't match.");
    } else {
      showError('Không đăng nhập được. Thử lại sau giây lát.', "Couldn't sign in. Please try again in a moment.");
    }
  } finally {
    busy = false;
    submit.disabled = false;
    submit.classList.remove('is-busy');
  }
});

/* Typing again clears the error — the message described the last attempt,
   not this one, and leaving it up makes a corrected password look rejected. */
for (const field of [userField, passField]) {
  field.addEventListener('input', () => {
    if (errorBox.classList.contains('is-error')) clearError();
  });
}

/* ── show/hide the password ──────────────────────────────
   Worth having on a site used on shared phones with unfamiliar keyboard
   layouts and diacritics, where a typo is otherwise invisible. */
const reveal = document.getElementById('revealPass');
reveal?.addEventListener('click', () => {
  const shown = passField.type === 'text';
  passField.type = shown ? 'password' : 'text';
  reveal.setAttribute('aria-pressed', String(!shown));
  reveal.setAttribute('aria-label',
    document.documentElement.lang === 'en'
      ? (shown ? 'Show password' : 'Hide password')
      : (shown ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'));
});

/* ── demo-mode credentials ───────────────────────────────
   Only ever printed when the server says it is serving sample data. The
   check is against the server's own health endpoint rather than a build
   flag, so a production deploy cannot accidentally ship a login hint. */
fetch('/api/health', { credentials: 'same-origin' })
  .then(r => r.ok ? r.json() : null)
  .then(h => {
    if (!h?.demo) return;
    const hint = document.getElementById('demoHint');
    if (!hint) return;
    hint.hidden = false;
    hint.append(
      el('strong', {}, t('Bản trình diễn', 'Demo build')),
      el('span', {}, t(
        ' — đăng nhập bằng demo / glow-demo-2026. Dữ liệu chỉ là ví dụ.',
        ' — sign in with demo / glow-demo-2026. The data is illustrative only.',
      )),
    );
  })
  .catch(() => { /* the hint is a convenience; its absence is not an error */ });
