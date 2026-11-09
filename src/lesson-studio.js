/* ═══════════════════════════════════════════════════════════
   Lesson Studio — lesson-studio.html. STAFF ONLY.

   Staff paste the facts from a trusted source; /api/lessons/draft (staff
   only, server-side) has EMMAI write an ORIGINAL lesson from only those
   facts. The draft lands in editable fields, and from there it goes to the
   Decap CMS — nothing is published from this page. A person presses
   Publish in the CMS, and that is the only way a lesson goes live.

   Handing a draft to the CMS: Decap 3.15 prefills a new entry from the URL
   query (/admin/#/collections/lessons/new?title=…), but it HTML-escapes
   every value first, so an apostrophe would arrive as "&#039;" and be saved
   that way. Straight quotes are therefore turned into typographic ones
   before they travel in the URL, and a field that still contains & < > is
   left out and named on screen, with "Copy as Markdown" as the way to bring
   it across. See docs/CMS-SETUP.md.
   ═══════════════════════════════════════════════════════════ */

import { initI18n } from './i18n.js';
import { initInteractions } from './interact.js';
import { initNav, loadAuth } from './nav.js';
import { api } from './api.js';
import { el, t, clear } from './ui.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
initInteractions({ reduced });
const i18n = initI18n({ reduced });
try { initNav(); } catch { /* the Studio matters more than the chrome */ }

const host = document.getElementById('studio');
const LEVELS = [
  ['beginner', 'Cơ bản / Beginner'],
  ['intermediate', 'Trung cấp / Intermediate'],
  ['advanced', 'Nâng cao / Advanced'],
];

const note = (kind, ...kids) => el('div', { class: `studio-msg is-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, ...kids);
const today = () => new Date().toISOString().slice(0, 10);

/* ── the draft, as a lesson file ───────────────────────── */

const oneLine = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const slugOf = s => oneLine(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'lesson';

/* word | tiếng Việt | meaning — one per line. A "|" inside a value would
   break the format, so it becomes "/". */
const keywordLines = list => list
  .map(k => [k.word, k.vi, k.meaning].map(v => oneLine(v).replace(/\|/g, '/')).join(' | '))
  .join('\n');

function toMarkdown(f) {
  const q = s => JSON.stringify(oneLine(s));
  return [
    '---',
    `title: ${q(f.title)}`,
    `titleVi: ${q(f.titleVi)}`,
    `date: ${f.date}`,
    `level: ${f.level}`,
    `summary: ${q(f.summary)}`,
    `summaryVi: ${q(f.summaryVi)}`,
    'sample: false',
    'keywords: |',
    ...f.keywords.split('\n').filter(l => l.trim()).map(l => `  ${l.trim()}`),
    '---',
    f.body.trim(),
    '',
  ].join('\n');
}

/* ' → ’ and paired " → “ ”, because Decap would store them as entities. */
const curly = s => s
  .replace(/'/g, '’')
  .replace(/(^|[\s([{—-])"/g, '$1“')
  .replace(/"/g, '”');

/* Decap keeps a string field's value only if we send it through
   escapeHtml first, so anything it would alter is unsafe to send. */
const risky = s => /[&<>"']/.test(s);

const CMS_FIELDS = [
  ['title', 'Title'], ['titleVi', 'Tiêu đề'], ['date', 'Date'], ['level', 'Level'],
  ['summary', 'Summary'], ['summaryVi', 'Tóm tắt'], ['body', 'Story'], ['keywords', 'Keywords'],
];
const MAX_URL = 30000;

function cmsUrl(f) {
  const sent = [], skipped = [];
  const params = [];
  for (const [name] of CMS_FIELDS) {
    const raw = String(f[name] ?? '').trim();
    if (!raw) continue;
    const value = curly(raw);
    if (risky(value)) { skipped.push(name); continue; }
    params.push([name, value]);
    sent.push(name);
  }
  params.push(['sample', 'false']);
  const build = () => `./admin/#/collections/lessons/new?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  /* The longest fields go first if the address gets unreasonable. */
  for (const drop of ['body', 'keywords']) {
    if (build().length <= MAX_URL) break;
    const i = params.findIndex(([k]) => k === drop);
    if (i >= 0) { params.splice(i, 1); sent.splice(sent.indexOf(drop), 1); skipped.push(drop); }
  }
  return { url: build(), sent, skipped };
}

/* Keywords the story does not contain would never light up in the reader. */
function missingKeywords(f) {
  return f.keywords.split('\n').map(l => oneLine(l.split('|')[0])).filter(Boolean)
    .filter(w => !new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(f.body));
}

/* ── errors, honestly ───────────────────────────────────── */

function failure(err) {
  if (err.status === 503 && err.code === 'emmai_off') {
    return note('notice',
      el('strong', {}, t('Soạn bài bằng AI sẽ bật khi có khoá API.', 'AI drafting switches on when the API key is added.')),
      el('p', {}, t('Trong lúc chờ, bạn vẫn có thể viết bài thủ công: mở một bài trống trong CMS và dán nội dung vào.',
        'Until then you can still write a lesson by hand: open a blank lesson in the CMS and paste your text in.')),
      el('a', { class: 'btn btn-quiet', href: './admin/#/collections/lessons/new', target: '_blank', rel: 'noopener' },
        t('Mở bài trống trong CMS', 'Open a blank lesson in the CMS')));
  }
  if (err.status === 403) {
    return note('error', t('Tài khoản này không có quyền dùng Lesson Studio. Chỉ nhân viên Pacific Links mới dùng được.',
      'This account is not allowed to use Lesson Studio. It is for Pacific Links staff only.'));
  }
  if (err.kind === 'auth') {
    return note('error', t('Phiên đăng nhập đã hết. ', 'Your session has ended. '),
      el('a', { href: './login.html?next=lesson-studio.html' }, t('Đăng nhập lại', 'Sign in again')));
  }
  if (err.status === 400) {
    return note('error', t('Thông tin chưa hợp lệ. Hãy kiểm tra chủ đề, cấp độ và phần nguồn tin (ít nhất 20 ký tự).',
      'Something in the form is not valid. Check the topic, the level and the source text (at least 20 characters).'));
  }
  if (err.kind === 'offline') {
    return note('error', t('Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.', 'Could not reach the server. Check your connection and try again.'));
  }
  if (err.kind === 'timeout') {
    return note('error', t('Máy chủ phản hồi quá lâu. Hãy thử lại, hoặc rút ngắn phần nguồn tin.', 'The server took too long. Try again, or shorten the source text.'));
  }
  return note('error', t('EMMAI đang gặp sự cố. Hãy thử lại sau ít phút.', 'EMMAI is having trouble. Please try again in a few minutes.'));
}

/* ── views ──────────────────────────────────────────────── */

function renderLocked() {
  clear(host).append(el('div', { class: 'panel studio-locked' },
    el('p', {}, t('Lesson Studio dành cho nhân viên Pacific Links.', 'Lesson Studio is for Pacific Links staff.')),
    el('p', {}, t('Hãy đăng nhập bằng tài khoản nhân viên để tiếp tục.', 'Please sign in with a staff account to continue.')),
    el('a', { class: 'btn btn-primary', href: './login.html?next=lesson-studio.html' }, t('Đăng nhập', 'Sign in'))));
  i18n.refresh();
}

function field(id, labelVi, labelEn, control, hint) {
  return el('div', { class: 'field' },
    el('label', { for: id }, t(labelVi, labelEn)),
    control,
    hint ? el('p', { class: 'field-hint', id: `${id}-hint` }, hint) : null);
}

function renderStudio() {
  const topic = el('input', { id: 'st-topic', type: 'text', maxlength: '200', required: true, autocomplete: 'off', 'aria-describedby': 'st-topic-hint' });
  const level = el('select', { id: 'st-level' }, LEVELS.map(([v, l]) => el('option', { value: v }, l)));
  const source = el('input', { id: 'st-source', type: 'text', maxlength: '300', autocomplete: 'off', 'aria-describedby': 'st-source-hint' });
  const facts = el('textarea', { id: 'st-facts', rows: '9', maxlength: '6000', required: true, 'aria-describedby': 'st-facts-hint st-count' });
  const count = el('span', { id: 'st-count', class: 'studio-count' }, '0 / 6000');
  facts.addEventListener('input', () => { count.textContent = `${facts.value.length} / 6000`; });

  const submit = el('button', { type: 'submit', class: 'btn btn-primary' },
    el('span', { class: 'btn-label' }, t('Soạn bản nháp', 'Draft the lesson')));
  const out = el('div', { class: 'studio-out', 'aria-live': 'polite' });

  const form = el('form', { class: 'panel studio-form', novalidate: true },
    el('p', { class: 'studio-guide' }, t(
      'Dán các dữ kiện từ một nguồn đáng tin cậy. EMMAI sẽ viết một bài học gốc, chỉ dựa trên những dữ kiện này.',
      'Paste the facts from a trusted source. EMMAI writes an original lesson from only these facts.')),
    field('st-topic', 'Chủ đề', 'Topic', topic,
      t('Ví dụ: “Giá gạo xuất khẩu”.', 'For example: “Rice exports”.')),
    el('div', { class: 'studio-row' },
      field('st-level', 'Cấp độ', 'Level', level),
      field('st-source', 'Nguồn (tên hoặc đường dẫn)', 'Source (name or link)', source)),
    field('st-facts', 'Dữ kiện từ nguồn tin', 'Facts from the source', facts,
      t('Ít nhất 20 ký tự. Không dán lại nguyên văn cả bài: chỉ cần các dữ kiện chính.',
        'At least 20 characters. No need to paste a whole article: the key facts are enough.')),
    count,
    el('p', { class: 'studio-warn' }, t('Chưa có gì được đăng cho đến khi nhân viên bấm Publish trong CMS.',
      'Nothing is published until a staff member presses Publish in the CMS.')),
    submit);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clear(out);
    if (!topic.value.trim() || facts.value.trim().length < 20) {
      out.append(note('error', t('Hãy nhập chủ đề và ít nhất 20 ký tự dữ kiện.', 'Enter a topic and at least 20 characters of facts.')));
      (topic.value.trim() ? facts : topic).focus();
      return;
    }
    submit.disabled = true;
    out.append(note('notice', t('EMMAI đang soạn bài, có thể mất đến một phút…', 'EMMAI is drafting; this can take up to a minute…')));
    i18n.refresh();
    try {
      const res = await api.lessonDraft({
        topic: topic.value.trim(), level: level.value,
        facts: facts.value.trim(), source: source.value.trim(),
      });
      clear(out).append(renderDraft(res.draft, level.value, res.demo));
    } catch (err) {
      clear(out).append(failure(err));
    } finally {
      submit.disabled = false;
      i18n.refresh();
    }
    out.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });

  clear(host).append(form, out);
  i18n.refresh();
}

function renderDraft(d, levelValue, demo) {
  const f = {
    title: d.title || '', titleVi: d.titleVi || '', date: today(), level: levelValue,
    summary: d.summary || '', summaryVi: d.summaryVi || '', body: d.body || '',
    keywords: keywordLines(Array.isArray(d.keywords) ? d.keywords : []),
  };
  const box = (id, key, rows, labelVi, labelEn) => {
    const c = rows
      ? el('textarea', { id, rows: String(rows) })
      : el('input', { id, type: 'text' });
    c.value = f[key];
    c.addEventListener('input', () => { f[key] = c.value; refreshChecks(); });
    return field(id, labelVi, labelEn, c);
  };

  const checkBox = el('div', { class: 'studio-checks', 'aria-live': 'polite' });
  const refreshChecks = () => {
    clear(checkBox);
    const miss = missingKeywords(f);
    if (miss.length) {
      checkBox.append(note('error', t('Từ khoá không xuất hiện trong bài, nên sẽ không sáng lên khi đọc: ', 'Keywords not found in the story, so they will not light up: '), el('strong', {}, miss.join(', '))));
    }
    i18n.refresh();
  };

  const cmsMsg = el('div', { class: 'studio-cmsmsg', 'aria-live': 'polite' });
  const mdArea = el('textarea', { class: 'studio-md', readonly: true, rows: '10', 'aria-label': 'Markdown' });
  const mdBox = el('details', { class: 'studio-mdbox' },
    el('summary', {}, t('Xem toàn bộ tệp Markdown', 'View the whole Markdown file')), mdArea);

  const openCms = el('button', { type: 'button', class: 'btn btn-primary' },
    t('Mở trong CMS để duyệt và đăng', 'Open in CMS to review and publish'));
  openCms.addEventListener('click', () => {
    const { url, sent, skipped } = cmsUrl(f);
    window.open(url, '_blank', 'noopener');
    clear(cmsMsg);
    const label = n => CMS_FIELDS.find(([k]) => k === n)[1];
    cmsMsg.append(note(skipped.length ? 'error' : 'notice',
      t(`Đã điền sẵn: ${sent.map(label).join(', ')}. `, `Pre-filled: ${sent.map(label).join(', ')}. `),
      skipped.length
        ? t(`CMS không nhận được: ${skipped.map(label).join(', ')}. Hãy sao chép nội dung ô đó ở trên rồi dán vào CMS, hoặc dùng “Sao chép Markdown” để lấy cả tệp. `,
            `The CMS could not take: ${skipped.map(label).join(', ')}. Copy that box from above and paste it into the CMS, or use “Copy as Markdown” for the whole file. `)
        : null,
      t('Dấu nháy thẳng được đổi thành dấu cong để CMS giữ đúng.', 'Straight quotes are turned into curly ones so the CMS keeps them intact.')));
    i18n.refresh();
  });

  const copyBtn = el('button', { type: 'button', class: 'btn btn-quiet' }, t('Sao chép Markdown', 'Copy as Markdown'));
  copyBtn.addEventListener('click', async () => {
    const md = toMarkdown(f);
    mdArea.value = md;
    clear(cmsMsg);
    try {
      await navigator.clipboard.writeText(md);
      cmsMsg.append(note('notice', t('Đã sao chép tệp Markdown. Tên tệp gợi ý: ', 'Markdown copied. Suggested file name: '), el('code', {}, `content/lessons/${f.date}-${slugOf(f.title)}.md`)));
    } catch {
      mdBox.open = true;
      mdArea.focus(); mdArea.select();
      cmsMsg.append(note('notice', t('Trình duyệt không cho sao chép tự động. Hãy chọn và sao chép nội dung bên dưới.', 'The browser blocked copying. Select and copy the text below instead.')));
    }
    i18n.refresh();
  });

  refreshChecks();
  mdArea.value = toMarkdown(f);
  return el('div', { class: 'studio-draft' },
    demo ? note('notice', t('Đây là bản nháp thử nghiệm (chế độ demo).', 'This is a demo draft.')) : null,
    d.notes ? el('div', { class: 'studio-notes', role: 'note' },
      el('h2', {}, t('EMMAI nhắc bạn kiểm tra', 'EMMAI asks you to check')),
      el('p', { class: 'studio-notes-body', text: d.notes })) : null,
    el('div', { class: 'panel studio-edit' },
      el('h2', {}, t('Bản nháp — chỉnh sửa trước khi chuyển sang CMS', 'Draft — edit before sending it to the CMS')),
      box('d-title', 'title', 0, 'Tiêu đề (Tiếng Anh)', 'Title (English)'),
      box('d-titlevi', 'titleVi', 0, 'Tiêu đề (Tiếng Việt)', 'Title (Vietnamese)'),
      box('d-summary', 'summary', 2, 'Tóm tắt (Tiếng Anh)', 'Summary (English)'),
      box('d-summaryvi', 'summaryVi', 2, 'Tóm tắt (Tiếng Việt)', 'Summary (Vietnamese)'),
      box('d-body', 'body', 14, 'Bài đọc (Tiếng Anh)', 'Story (English)'),
      box('d-keywords', 'keywords', 9, 'Từ khoá — mỗi dòng: từ | tiếng Việt | nghĩa tiếng Anh', 'Keywords — one per line: word | Vietnamese | English meaning'),
      checkBox),
    el('p', { class: 'studio-warn' }, t('Chưa có gì được đăng cho đến khi nhân viên bấm Publish trong CMS.',
      'Nothing is published until a staff member presses Publish in the CMS.')),
    el('div', { class: 'studio-actions' }, openCms, copyBtn),
    cmsMsg, mdBox);
}

/* ── boot ───────────────────────────────────────────────── */

host.append(el('p', { class: 'studio-wait' }, t('Đang kiểm tra tài khoản…', 'Checking your account…')));
loadAuth().then(me => {
  if (me?.learner?.role === 'staff') renderStudio();
  else renderLocked();
  i18n.refresh();
});
