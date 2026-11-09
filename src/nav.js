/* ═══════════════════════════════════════════════════════════
   The site chrome's behaviour — shared by every page that has the header:
   the landing page, the signed-in shell and the story reader.

   initNav()    wires the Courses dropdown, the search toggle and Sign out.
   applyAuth()  turns the header over once the session is known, and
                reveals everything marked [data-staff] for a staff account,
                [data-member] for any signed-in account, and hides [data-guest].

   The markup is signed out, with the dropdown closed and the search form
   tucked away, so a crawler and a visitor with no JavaScript see a header
   that is true for them. Nothing here is needed to reach a page.
   ═══════════════════════════════════════════════════════════ */

import { api, signOut } from './api.js';
import { el, t, clear } from './ui.js';

const pageFile = () => {
  const last = location.pathname.split('/').pop() || 'index.html';
  return last.includes('.') ? last : `${last}.html`;
};

/* Disclosure, not an ARIA menu: a list of ordinary links that opens and
   closes. Enter and Space come free with <button>; Esc closes and hands
   focus back to the button; Tab out of it, or a click elsewhere, closes. */
function wireDropdown(dd) {
  const btn = dd.querySelector('.navdd-btn');
  const menu = dd.querySelector('.navdd-menu');
  if (!btn || !menu) return;

  const set = open => {
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };
  btn.addEventListener('click', () => set(menu.hidden));
  dd.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); }
  });
  dd.addEventListener('focusout', e => {
    if (e.relatedTarget && !dd.contains(e.relatedTarget)) set(false);
  });
  document.addEventListener('click', e => { if (!dd.contains(e.target)) set(false); });

  /* The button is "here" when the page is one of the menu's own. */
  const here = pageFile();
  if ([...menu.querySelectorAll('a')].some(a => new URL(a.href, location.href).pathname.endsWith(here)
      && here !== 'index.html')) btn.classList.add('is-here');
}

/* The icon is a real link to the courses page, which has a search box of
   its own, so it still works with scripts off. With them on it opens a
   small form instead. */
function wireSearch(wrap) {
  const btn = wrap.querySelector('.navsearch-btn');
  const form = wrap.querySelector('.navsearch');
  const input = form?.querySelector('input');
  if (!btn || !form || !input) return;

  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', form.id);

  const set = open => {
    btn.setAttribute('aria-expanded', String(open));
    form.hidden = !open;
    if (open) input.focus();
  };
  btn.addEventListener('click', e => { e.preventDefault(); set(form.hidden); });
  btn.addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); set(form.hidden); }
  });
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !form.hidden) { set(false); btn.focus(); }
  });
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) set(false); });
}

export function initNav() {
  document.querySelectorAll('.navdd').forEach(wireDropdown);
  document.querySelectorAll('.navsearch-wrap').forEach(wireSearch);
  document.getElementById('signOut')?.addEventListener('click', e => {
    e.preventDefault();
    signOut();
  });
}

/* The signed-in chip reads "<learner code> <full name>". A staff account
   has no learner code, so it says what it is instead. Missing fields never
   break it: an adapter that returns no idnumber falls back to the username. */
export function applyAuth(learner) {
  const who = document.querySelector('.who');
  const out = document.getElementById('signOut');
  const inn = document.getElementById('signIn');
  const name = document.querySelector('.who-name');
  const avatar = document.querySelector('.who .avatar');
  const staff = learner?.role === 'staff';

  document.querySelectorAll('[data-staff]').forEach(n => { n.hidden = !staff; });
  document.querySelectorAll('[data-guest]').forEach(n => { n.hidden = !!learner; });
  document.querySelectorAll('[data-member]').forEach(n => { n.hidden = !learner; });

  if (!learner) {
    if (name) clear(name);
    if (avatar) avatar.textContent = '';
    who?.setAttribute('hidden', '');
    out?.setAttribute('hidden', '');
    inn?.removeAttribute('hidden');
    return;
  }

  const full = learner.fullname || learner.username || '';
  const code = learner.idnumber || (staff ? null : learner.username);
  if (name) {
    clear(name);
    name.append(
      el('span', { class: 'who-code' }, code || (staff ? t('Nhân viên', 'Staff') : null)),
      el('span', { class: 'who-full', text: full }),
    );
  }
  if (avatar) avatar.textContent = learner.initials || '?';

  if (who) {
    who.setAttribute('href', './dashboard.html');
    who.setAttribute('aria-label',
      document.documentElement.lang === 'en' ? `Signed in as ${full}` : `Đang đăng nhập: ${full}`);
    who.removeAttribute('hidden');
  }
  inn?.setAttribute('hidden', '');
  out?.removeAttribute('hidden');
}

/* The pages with no session logic of their own (the landing page, the story
   reader): one check, a 401 or an unreachable server both mean signed out. */
export async function loadAuth() {
  let me = null;
  try { me = await api.me(); } catch { /* signed out, or no API on this host */ }
  applyAuth(me?.learner || null);
  return me;
}
