/* ═══════════════════════════════════════════════════════════
   EMMAI — GLOW's AI advisor, as a dialog.

   `openEmmai({ prompt })` opens it; any `[data-emmai-open]` button on any
   page does the same (optionally `data-emmai-prompt="…"`). A drawer on
   desktop, full-screen on a phone. A native <dialog> gives the focus trap,
   Esc and an inert page behind it; focus goes back to whatever opened it.

   Reply text is only ever set as text. Course codes in it become links by
   splitting the string and building <a> nodes — never innerHTML.

   History is in memory plus sessionStorage (this tab only, gone when the tab
   closes). The server stores nothing.
   ═══════════════════════════════════════════════════════════ */

import { api } from './api.js';
import { el, t, clear, currentLang } from './ui.js';

const STORE = 'glow.emmai';
const KEEP = 40;      // messages kept in the tab
const SEND = 16;      // the server accepts at most 16

const STARTERS = [
  ['Mình nên bắt đầu học tiếng Anh từ đâu?', 'Where should I start with English?'],
  ['Gợi ý cho mình một khoá học kỹ năng mềm', 'Suggest a soft-skills course for me'],
  ['Mình muốn luyện thi IELTS', 'I want to prepare for IELTS'],
];

/* [CODE] as the model writes it, or a bare catalogue-shaped code (EL1001).
   shortcut: the pattern is not checked against the catalogue, so an unknown
   code lands on the "course not found" page; the server only lets the model
   cite codes it was given, so upgrade if that ever shows up. */
const CODE = /\[([A-Z]{2,6}\d{0,4})\]|\b([A-Z]{2}\d{4})\b/g;

let history = [];
try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]').filter(m => m && typeof m.content === 'string'); } catch { history = []; }
const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-KEEP))); } catch { /* private mode */ } };

let dlg, log, input, sendBtn, form, starters, opener, busy = false;

/* Text with course codes turned into links, as DOM nodes. */
function linkify(text) {
  const nodes = [];
  let last = 0;
  for (const m of text.matchAll(CODE)) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const code = m[1] || m[2];
    nodes.push(el('a', { class: 'emmai-code', href: `./course.html?code=${encodeURIComponent(code)}`, text: code }));
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function bubble(role, text) {
  const body = role === 'user' ? [text] : linkify(text);
  return el('li', { class: `emmai-msg emmai-${role}` }, el('p', {}, body));
}

const scrollDown = () => { log.scrollTop = log.scrollHeight; };

function note(kind, ...content) {
  return el('li', { class: `emmai-note emmai-note-${kind}`, role: kind === 'error' ? 'alert' : null }, ...content);
}

function errorNote(err) {
  if (err.code === 'emmai_off') return note('off', t('EMMAI sắp được bật.', 'EMMAI is switching on soon.'));
  if (err.kind === 'auth') return note('error', t('Phiên đăng nhập đã hết. Hãy đăng nhập lại.', 'Your session has ended. Please sign in again.'));
  if (err.status === 429) return note('error', t('Bạn nhắn hơi nhanh. Hãy đợi một chút rồi thử lại.', 'You are sending messages too fast. Wait a moment and try again.'));
  if (err.kind === 'offline') return note('error', t('Không có kết nối mạng. Hãy kiểm tra rồi thử lại.', 'No connection. Check it and try again.'));
  return note('error', t('EMMAI đang gặp sự cố. Hãy thử lại sau ít phút.', 'EMMAI is having trouble. Please try again in a few minutes.'));
}

function render() {
  clear(log);
  history.forEach(m => log.append(bubble(m.role, m.content)));
  starters.hidden = history.length > 0;
  scrollDown();
}

async function send(text) {
  text = text.trim().slice(0, 1200);
  if (!text || busy) return;
  busy = true;
  sendBtn.disabled = true;

  history.push({ role: 'user', content: text });
  save();
  log.querySelectorAll('.emmai-note').forEach(n => n.remove());
  log.append(bubble('user', text));
  starters.hidden = true;
  input.value = '';
  const typing = el('li', { class: 'emmai-note emmai-typing', 'aria-label': currentLang() === 'en' ? 'EMMAI is typing' : 'EMMAI đang trả lời' },
    el('span', {}), el('span', {}), el('span', {}));
  log.append(typing);
  scrollDown();

  /* The server wants a conversation that starts with the learner. */
  let msgs = history.slice(-SEND);
  while (msgs.length && msgs[0].role !== 'user') msgs = msgs.slice(1);

  try {
    const res = await api.emmai({ messages: msgs, lang: currentLang() });
    history.push({ role: 'assistant', content: res.reply });
    save();
    typing.remove();
    log.append(bubble('assistant', res.reply));
  } catch (err) {
    /* Give the learner their words back instead of making them retype. */
    history.pop();
    save();
    typing.remove();
    log.lastElementChild?.classList.contains('emmai-user') && log.lastElementChild.remove();
    input.value = text;
    log.append(errorNote(err));
    if (history.length === 0) starters.hidden = err.code === 'emmai_off';
  } finally {
    busy = false;
    sendBtn.disabled = false;
    scrollDown();
    input.focus();
  }
}

function newChat() {
  history = [];
  save();
  render();
  input.focus();
}

function build() {
  const starterBtns = STARTERS.map(([vi, en]) =>
    el('button', { type: 'button', class: 'emmai-chip', onclick: () => send(currentLang() === 'en' ? en : vi) }, t(vi, en)));

  log = el('ol', { class: 'emmai-log', 'aria-live': 'polite', 'aria-label': 'EMMAI', tabindex: '0' });
  starters = el('div', { class: 'emmai-starters' },
    el('p', {}, t('Bạn có thể hỏi thử:', 'You could try:')), starterBtns);

  input = el('textarea', {
    class: 'emmai-input', rows: '2', maxlength: '1200', 'aria-label': 'EMMAI',
    onkeydown: e => {
      /* e.isComposing: Vietnamese input methods use Enter to confirm a syllable. */
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    },
  });
  sendBtn = el('button', { class: 'btn btn-primary emmai-send', type: 'submit' }, t('Gửi', 'Send'));
  form = el('form', { class: 'emmai-form', onsubmit: e => { e.preventDefault(); send(input.value); } }, input, sendBtn);

  const closeBtn = el('button', { class: 'emmai-x', type: 'button', onclick: () => dlg.close() },
    el('span', { 'aria-hidden': 'true', text: '×' }),
    el('span', { class: 'sr-only' }, t('Đóng', 'Close')));

  dlg = el('dialog', { class: 'emmai', 'aria-labelledby': 'emmaiTitle' },
    el('header', { class: 'emmai-head' },
      el('h2', { id: 'emmaiTitle' }, t('EMMAI — cố vấn AI của GLOW', "EMMAI — GLOW's AI advisor")),
      el('div', { class: 'emmai-tools' },
        el('button', { class: 'emmai-new', type: 'button', onclick: newChat }, t('Cuộc trò chuyện mới', 'New chat')),
        closeBtn)),
    el('p', { class: 'emmai-privacy' },
      t('EMMAI không lưu tin nhắn của bạn. Đừng chia sẻ mật khẩu hay thông tin cá nhân.',
        "EMMAI doesn't keep your messages. Don't share passwords or personal details.")),
    log, starters, form);

  /* A click on the backdrop lands on the <dialog> itself. */
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { opener?.isConnected && opener.focus(); opener = null; });
  document.body.append(dlg);

  /* Attributes the language toggle does not reach. */
  const lang = () => {
    const en = currentLang() === 'en';
    input.placeholder = en ? 'Ask about courses or learning English…' : 'Hỏi về khoá học hoặc cách học tiếng Anh…';
    input.setAttribute('aria-label', en ? 'Your message to EMMAI' : 'Tin nhắn gửi EMMAI');
    log.setAttribute('aria-label', en ? 'Conversation with EMMAI' : 'Cuộc trò chuyện với EMMAI');
  };
  lang();
  new MutationObserver(lang).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  render();
}

export function openEmmai({ prompt } = {}) {
  if (!dlg) build();
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!dlg.open) dlg.showModal();
  /* The role's suggested question goes in the box; the learner decides to send it. */
  if (prompt && !history.length && !input.value) input.value = String(prompt).slice(0, 1200);
  input.focus();
}

document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-emmai-open]');
  if (!b) return;
  e.preventDefault();
  openEmmai({ prompt: b.dataset.emmaiPrompt });
});
