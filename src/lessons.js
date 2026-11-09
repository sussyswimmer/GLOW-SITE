/* ═══════════════════════════════════════════════════════════
   English through the news — lessons.html (the list) and
   lesson.html?slug=… (the reader). One entry for both pages.

   Like the story reader there is no API: lessons are baked into the page
   at build time by tools/content-plugin.mjs, and this file only puts the
   requested one on screen. Everything here is progressive — without
   JavaScript the list is still a list and the reader says it needs JS.

   The reader:
   - listens: <audio> when the lesson has a recording, otherwise the
     browser's own speechSynthesis (en-US voice, paragraph by paragraph);
   - turns each keyword's FIRST occurrence in the story into a button that
     opens a popover (Vietnamese, English meaning, save, speak). Later
     occurrences stay plain text, so the story does not turn into a wall
     of tab stops;
   - keeps a word bank in localStorage — saved on this device only.
   ═══════════════════════════════════════════════════════════ */

import { initI18n, setDocTitle } from './i18n.js';
import { initInteractions } from './interact.js';
import { initNav, loadAuth } from './nav.js';
import { el, t, clear } from './ui.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
initInteractions({ reduced });
const i18n = initI18n({ reduced });

/* The header's own behaviour lives in nav.js. A page whose header predates
   it must still work, so a failure here is never fatal. */
let staff = false;
try {
  initNav();
  loadAuth().then(me => {
    staff = me?.learner?.role === 'staff';
    document.querySelectorAll('[data-staff]').forEach(n => { n.hidden = !staff; });
  });
} catch { /* the lesson matters more than the chrome */ }

const LEVEL = {
  beginner:     { vi: 'Cơ bản',    en: 'Beginner' },
  intermediate: { vi: 'Trung cấp', en: 'Intermediate' },
  advanced:     { vi: 'Nâng cao',  en: 'Advanced' },
};

/* ── the list ───────────────────────────────────────────── */

function initList() {
  const filter = document.getElementById('lessonFilter');
  const cards = [...document.querySelectorAll('#lessonList .lesson-card')];
  const none = document.getElementById('lessonNone');
  if (!filter || !cards.length) return;

  filter.hidden = false;
  filter.addEventListener('click', e => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    const level = btn.dataset.filter;
    filter.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    let shown = 0;
    cards.forEach(c => {
      const show = level === 'all' || c.dataset.level === level;
      c.hidden = !show;
      if (show) shown++;
    });
    none.hidden = shown > 0;
  });
}

/* ── speech ─────────────────────────────────────────────── */

const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function englishVoice() {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => /^en[-_]US$/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
}

function utterance(text, rate) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const v = englishVoice();
  if (v) u.voice = v;
  return u;
}

/* ── the word bank (this device only) ──────────────────── */

const BANK_KEY = 'glow.wordbank';

function loadBank() {
  try {
    const v = JSON.parse(localStorage.getItem(BANK_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function storeBank(bank) {
  try { localStorage.setItem(BANK_KEY, JSON.stringify(bank)); return true; } catch { return false; }
}

/* ── the reader ─────────────────────────────────────────── */

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function setHeading(vi, en) {
  const h1 = document.querySelector('.pagehead h1');
  if (h1) { h1.dataset.vi = vi; h1.dataset.en = en; h1.setAttribute('lang', 'en'); }
  const crumbNow = document.querySelector('.crumbs .crumb-now');
  if (crumbNow) { crumbNow.dataset.vi = vi; crumbNow.dataset.en = en; }
  setDocTitle(`${vi} | GLOW`, `${en} | GLOW`);
}

function lessons() {
  try {
    return JSON.parse(document.getElementById('glowLessons')?.textContent || '[]');
  } catch { return []; }
}

/* A button with a bilingual label that can change (Play ⇄ Stop). */
function relabel(node, vi, en) {
  clear(node);
  node.append(t(vi, en));
}

const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

function speakButton(text, labelVi, labelEn) {
  const b = el('button', {
    type: 'button', class: 'kw-speak', 'aria-label': `${labelVi} / ${labelEn}`,
    title: `${labelVi} / ${labelEn}`,
    onclick: () => { speechSynthesis.cancel(); speechSynthesis.speak(utterance(text, 0.9)); },
  });
  b.innerHTML = SPEAKER;   // literal markup from this file, never data
  return b;
}

function renderReader(host, lesson) {
  setHeading(lesson.title, lesson.title);

  const bank = { items: loadBank(), ok: true };
  const saveButtons = [];          // every Save button, kept in step with the bank
  const isSaved = k => bank.items.some(i => i.word.toLowerCase() === k.word.toLowerCase());

  /* ── header ── */
  const lvl = LEVEL[lesson.level] || LEVEL.beginner;
  const head = el('header', { class: 'lesson-head' },
    el('p', { class: 'lesson-tags' },
      el('span', { class: `lesson-level lv-${lesson.level}` }, t(lvl.vi, lvl.en)),
      lesson.sample ? el('span', { class: 'lesson-sample' }, t('Bài mẫu', 'Sample lesson')) : null,
      el('time', { datetime: lesson.date.iso, 'data-i18n': '', 'data-vi': lesson.date.vi, 'data-en': lesson.date.en, text: lesson.date.vi })),
    el('p', { class: 'lesson-titlevi', 'data-i18n': '', 'data-vi': lesson.titleVi, 'data-en': lesson.titleVi, text: lesson.titleVi }),
    el('p', { class: 'lesson-lede', lang: 'en', text: lesson.summary }));

  /* ── Vietnamese summary toggle ── */
  const sumText = el('p', { class: 'lesson-sumvi', id: 'lessonSumVi', hidden: true, text: lesson.summaryVi });
  const sumBtn = el('button', { type: 'button', class: 'lesson-sumbtn', 'aria-expanded': 'false', 'aria-controls': 'lessonSumVi' });
  relabel(sumBtn, 'Xem tóm tắt tiếng Việt', 'Show Vietnamese summary');
  sumBtn.addEventListener('click', () => {
    const open = sumText.hidden;
    sumText.hidden = !open;
    sumBtn.setAttribute('aria-expanded', String(open));
    relabel(sumBtn, open ? 'Ẩn tóm tắt tiếng Việt' : 'Xem tóm tắt tiếng Việt',
      open ? 'Hide Vietnamese summary' : 'Show Vietnamese summary');
  });

  /* ── the story ── */
  const body = el('div', { class: 'lesson-body', lang: 'en' });
  body.innerHTML = lesson.body;   // marked at build time, same trust as a story body

  /* ── listen ── */
  let listen = null;
  let stopSpeech = () => {};
  if (lesson.audio) {
    listen = el('div', { class: 'lesson-listen' },
      el('span', { class: 'lesson-listen-label' }, t('Nghe bài đọc', 'Listen')),
      el('audio', { controls: true, preload: 'none', src: lesson.audio }));
  } else if (canSpeak) {
    const play = el('button', { type: 'button', class: 'btn btn-primary lesson-play' });
    const speed = el('select', { id: 'lessonSpeed', class: 'lesson-speed' },
      el('option', { value: '1' }, '1×'), el('option', { value: '0.8' }, '0.8×'));
    const paras = () => [...body.querySelectorAll('p, li')];
    let playing = false;
    const mark = n => paras().forEach(p => p.classList.toggle('is-reading', p === n));
    const setPlaying = on => {
      playing = on;
      play.setAttribute('aria-pressed', String(on));
      relabel(play, on ? 'Dừng' : 'Nghe bài', on ? 'Stop' : 'Listen');
      if (!on) mark(null);
    };
    stopSpeech = () => { if (playing) { speechSynthesis.cancel(); setPlaying(false); } };
    play.addEventListener('click', () => {
      if (playing) { stopSpeech(); return; }
      speechSynthesis.cancel();
      const list = paras();
      const rate = Number(speed.value) || 1;
      setPlaying(true);
      list.forEach((p, i) => {
        const u = utterance(p.textContent, rate);
        u.onstart = () => mark(p);
        u.onend = () => { if (i === list.length - 1) setPlaying(false); };
        u.onerror = () => { if (i === list.length - 1) setPlaying(false); };
        speechSynthesis.speak(u);
      });
    });
    setPlaying(false);
    listen = el('div', { class: 'lesson-listen' },
      play,
      el('label', { class: 'lesson-speed-label', for: 'lessonSpeed' }, t('Tốc độ', 'Speed')),
      speed,
      el('span', { class: 'lesson-listen-note' }, t('Giọng đọc của trình duyệt', 'Browser voice')));
  }
  addEventListener('pagehide', () => { if (canSpeak) speechSynthesis.cancel(); });

  /* ── popover ── */
  const pop = el('div', { class: 'kw-pop', role: 'dialog', tabindex: '-1', hidden: true });
  let popFor = null, popKw = null;
  const closePop = (returnFocus = true) => {
    if (!popFor) return;
    pop.hidden = true;
    popFor.setAttribute('aria-expanded', 'false');
    if (returnFocus) popFor.focus();
    popFor = popKw = null;
  };
  const openPop = (btn, k) => {
    if (popFor === btn) { closePop(); return; }
    closePop(false);
    popFor = btn; popKw = k;
    btn.setAttribute('aria-expanded', 'true');
    clear(pop);
    pop.setAttribute('aria-label', k.word);
    const save = saveButton(k, 'btn btn-primary kw-save');
    pop.append(
      el('p', { class: 'kw-word', lang: 'en', text: k.word }),
      el('p', { class: 'kw-vi', text: k.vi }),
      k.meaning ? el('p', { class: 'kw-meaning', lang: 'en', text: k.meaning }) : null,
      el('div', { class: 'kw-actions' },
        save,
        canSpeak ? speakButton(k.word, 'Nghe từ', 'Hear the word') : null,
        el('button', { type: 'button', class: 'kw-close', 'aria-label': 'Đóng / Close', onclick: () => closePop() }, '×')));
    pop.hidden = false;
    const host = pop.offsetParent || main;
    const h = host.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const w = pop.offsetWidth;
    pop.style.left = `${Math.max(0, Math.min(b.left - h.left, h.width - w))}px`;
    pop.style.top = `${b.bottom - h.top + 8}px`;
    pop.focus();
  };
  pop.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closePop(); return; }
    if (e.key !== 'Tab') return;
    /* A light trap: the popover is small and modeless, but Tab must not
       wander off behind it while it is the thing being read. */
    const f = [...pop.querySelectorAll('button')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === pop)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('click', e => {
    if (popFor && !pop.contains(e.target) && !popFor.contains(e.target)) closePop(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && popFor && !pop.contains(document.activeElement)) closePop(); });

  /* ── the word bank panel ── */
  const bankCount = el('span', { class: 'count', text: '0' });
  const bankList = el('ul', { class: 'bank-list' });
  const bankNote = el('p', { class: 'bank-note', role: 'status' });
  const renderBank = () => {
    clear(bankList);
    bankCount.textContent = String(bank.items.length);
    if (!bank.items.length) {
      bankList.append(el('li', { class: 'bank-empty' },
        t('Chưa có từ nào. Chạm vào một từ được gạch chân trong bài để lưu.',
          'No words yet. Tap an underlined word in the story to save it.')));
    }
    bank.items.forEach(i => bankList.append(el('li', { class: 'bank-item' },
      el('div', { class: 'bank-text' },
        el('strong', { lang: 'en', text: i.word }),
        el('span', { text: ` — ${i.vi}` }),
        i.meaning ? el('small', { lang: 'en', text: i.meaning }) : null),
      canSpeak ? speakButton(i.word, 'Nghe từ', 'Hear the word') : null,
      el('button', {
        type: 'button', class: 'bank-remove', 'aria-label': `Xoá / Remove: ${i.word}`,
        onclick: () => { bank.items = bank.items.filter(x => x !== i); persist(); },
      }, t('Xoá', 'Remove')))));
    bankNote.textContent = '';
    if (!bank.ok) bankNote.append(t('Trình duyệt này không cho lưu dữ liệu, nên sổ từ sẽ mất khi bạn đóng trang.',
      'This browser blocks storage, so the word bank will be lost when you close the page.'));
    saveButtons.forEach(s => s.sync());
    i18n.refresh();
  };
  const persist = () => { bank.ok = storeBank(bank.items); renderBank(); };

  function saveButton(k, cls) {
    const b = el('button', { type: 'button', class: cls });
    b.sync = () => {
      const on = isSaved(k);
      b.setAttribute('aria-pressed', String(on));
      relabel(b, on ? 'Đã lưu' : 'Lưu vào sổ từ', on ? 'Saved' : 'Save to word bank');
    };
    b.addEventListener('click', () => {
      if (isSaved(k)) bank.items = bank.items.filter(i => i.word.toLowerCase() !== k.word.toLowerCase());
      else bank.items.push({ word: k.word, vi: k.vi, meaning: k.meaning, lesson: lesson.slug });
      persist();
    });
    b.sync();
    saveButtons.push(b);
    return b;
  }

  const bankPanel = el('aside', { class: 'panel bank', 'aria-labelledby': 'bankTitle' },
    el('div', { class: 'bank-head' },
      el('h2', { id: 'bankTitle' }, t('Sổ từ của tôi', 'My word bank')), bankCount),
    el('p', { class: 'bank-sub' }, t('Lưu trên thiết bị này.', 'Saved on this device only.')),
    bankList, bankNote);

  /* ── the keyword list ── */
  const kwList = el('section', { class: 'panel kwlist', 'aria-labelledby': 'kwTitle' },
    el('h2', { id: 'kwTitle' }, t('Từ khoá trong bài', 'Keywords in this lesson')),
    el('ul', {}, lesson.keywords.map(k => el('li', { class: 'kwlist-item' },
      el('div', { class: 'bank-text' },
        el('strong', { lang: 'en', text: k.word }),
        el('span', { text: ` — ${k.vi}` }),
        k.meaning ? el('small', { lang: 'en', text: k.meaning }) : null),
      saveButton(k, 'btn btn-quiet kw-save-sm')))));

  const main = el('div', { class: 'lesson-main' },
    head, listen,
    el('div', { class: 'lesson-sum' }, sumBtn, sumText),
    body, pop);

  host.append(
    el('div', { class: 'lesson-layout' },
      el('div', { class: 'lesson-col' }, main, kwList),
      bankPanel),
    el('p', { class: 'story-back' },
      el('a', { href: './lessons.html' }, t('← Tất cả bài học', '← All lessons'))));

  /* ── keywords in the story ── */
  wrapKeywords(body, lesson.keywords, openPop);
  renderBank();
}

/* First occurrence of each keyword, case-insensitive, on word boundaries,
   never inside a link or another button, longest phrase first. */
function wrapKeywords(root, keywords, onOpen) {
  if (!keywords.length) return;
  const byLower = new Map(keywords.map(k => [k.word.toLowerCase(), k]));
  const alts = [...keywords].sort((a, b) => b.word.length - a.word.length).map(k => esc(k.word)).join('|');
  const re = new RegExp(`\\b(?:${alts})\\b`, 'gi');
  const done = new Set();

  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest('a, button, code, pre')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let last = 0, hit = false;
    re.lastIndex = 0;
    for (let m; (m = re.exec(text));) {
      const k = byLower.get(m[0].toLowerCase());
      if (!k || done.has(k)) continue;
      done.add(k); hit = true;
      frag.append(text.slice(last, m.index));
      const btn = el('button', { type: 'button', class: 'kw', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', text: m[0] });
      btn.addEventListener('click', () => onOpen(btn, k));
      frag.append(btn);
      last = m.index + m[0].length;
    }
    if (hit) { frag.append(text.slice(last)); node.replaceWith(frag); }
  }
}

/* ── boot ───────────────────────────────────────────────── */

const readerHost = document.getElementById('lesson');
if (readerHost) {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) {
    location.replace('./lessons.html');
  } else {
    const lesson = lessons().find(l => l.slug === slug);
    if (!lesson) {
      setHeading('Không tìm thấy bài học', 'Lesson not found');
      readerHost.append(
        el('p', { class: 'story-missing' }, t('Bài học này không tồn tại hoặc đã bị gỡ.', 'This lesson does not exist or has been taken down.')),
        el('p', { class: 'story-back' }, el('a', { href: './lessons.html' }, t('← Tất cả bài học', '← All lessons'))));
    } else {
      renderReader(readerHost, lesson);
    }
    i18n.refresh();
  }
} else {
  initList();
}
