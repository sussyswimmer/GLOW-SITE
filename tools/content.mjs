/* ═══════════════════════════════════════════════════════════
   The content layer — what the CMS edits, read back into the pages.

   Two kinds of content live under content/:

   - content/landing.json    every editable string on the marketing page,
                             as {vi, en} pairs. index.html holds structure
                             and {{token.path.vi}} placeholders; this file
                             holds the words. Decap CMS edits it directly.
   - content/stories/*.md    one file per story. Vietnamese body below the
                             frontmatter, English body and both titles /
                             excerpts in it. Decap CMS creates these.

   Nothing here runs in the browser. contentPlugin() in content-plugin.mjs
   calls into this at dev-serve and build time, so the shipped HTML is
   identical to what a hand-authored page would have been — the file://
   constraint, the no-JS reading path and the VI/EN toggle all survive
   because, as far as the output is concerned, nothing changed.
   ═══════════════════════════════════════════════════════════ */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const root = process.cwd();
const r = p => resolve(root, p);

/* Same escaping rule as tools/build-pages.mjs: everything interpolated into
   markup goes through this — landing copy is our own, but stories are typed
   by the client's staff, which is exactly who escaping exists for. */
export const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ── the landing page's words ───────────────────────────── */

export function loadLanding() {
  return JSON.parse(readFileSync(r('content/landing.json'), 'utf8'));
}

/* {{hero.lead.vi}} → the value at that path, HTML-escaped. A token that
   names a key which does not exist fails the build by design: a typo that
   silently rendered "{{hero.laed.vi}}" onto the page would be worse. */
export function injectTokens(html, landing) {
  return html.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const value = path.split('.').reduce((o, k) => o?.[k], landing);
    if (value == null || typeof value === 'object') {
      throw new Error(`content/landing.json has no value at "${path}" (referenced from a page template)`);
    }
    return esc(value);
  });
}

/* ── stories ────────────────────────────────────────────── */

const md = s => marked.parse(String(s ?? ''), { async: false });

/* Dates render at build time, in both languages, so the story pages need
   no locale logic in the browser and read correctly with JavaScript off. */
const MONTHS_EN = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return { iso: String(iso ?? ''), vi: String(iso ?? ''), en: String(iso ?? '') };
  const [, y, mo, d] = m;
  const day = Number(d), month = Number(mo);
  return {
    iso: `${y}-${mo}-${d}`,
    vi: `Ngày ${day} tháng ${month}, ${y}`,
    en: `${day} ${MONTHS_EN[month - 1]} ${y}`,
  };
}

export function loadStories() {
  const dir = r('content/stories');
  if (!existsSync(dir)) return [];

  const stories = readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data, content } = matter(readFileSync(resolve(dir, f), 'utf8'));
      const slug = basename(f, '.md');
      /* gray-matter parses an unquoted `date: 2026-08-24` into a Date; a
         quoted one stays a string. Both arrive here as ISO-sortable text. */
      const date = data.date instanceof Date
        ? data.date.toISOString().slice(0, 10)
        : String(data.date ?? '');
      return {
        slug,
        title:    { vi: data.title ?? slug, en: data.title_en || data.title || slug },
        excerpt:  { vi: data.excerpt ?? '', en: data.excerpt_en || data.excerpt || '' },
        cover:    data.cover || '',
        date:     formatDate(date),
        /* Markdown → HTML happens here, once, at build — the reader page
           only ever injects finished markup. An English body is optional;
           a story without one shows Vietnamese in both languages rather
           than a blank page. */
        body:     { vi: md(content), en: data.body_en ? md(data.body_en) : '' },
      };
    })
    .sort((a, b) => b.date.iso.localeCompare(a.date.iso));

  return stories;
}

/* ── the listing, as static markup ──────────────────────────
   Injected into stories.html in place of <!--@stories-->, so the page is
   fully readable with JavaScript off and indexable — the same principle as
   the catalogue pages in tools/build-pages.mjs. Bilingual via the same
   data-vi / data-en attributes src/i18n.js already swaps. */
export function storiesListMarkup(stories) {
  if (!stories.length) {
    return `<p class="stories-empty" data-i18n data-vi="Chưa có bài viết nào." data-en="No stories yet.">Chưa có bài viết nào.</p>`;
  }
  return stories.map(s => {
    const coverEl = s.cover
      ? `<span class="story-cover"><img src="${esc(s.cover)}" alt="" loading="lazy" decoding="async"></span>`
      : '';
    return [
      `<a class="story-card" href="./story.html?slug=${encodeURIComponent(s.slug)}">`,
      `  ${coverEl}`,
      '  <span class="story-meta">',
      `    <time datetime="${esc(s.date.iso)}" data-i18n data-vi="${esc(s.date.vi)}" data-en="${esc(s.date.en)}">${esc(s.date.vi)}</time>`,
      `    <h3 data-i18n data-vi="${esc(s.title.vi)}" data-en="${esc(s.title.en)}">${esc(s.title.vi)}</h3>`,
      `    <p data-i18n data-vi="${esc(s.excerpt.vi)}" data-en="${esc(s.excerpt.en)}">${esc(s.excerpt.vi)}</p>`,
      `    <span class="story-more" aria-hidden="true" data-i18n data-vi="Đọc tiếp →" data-en="Read on →">Đọc tiếp →</span>`,
      '  </span>',
      '</a>',
    ].join('\n');
  }).join('\n');
}

/* The full set as JSON for story.html's inline data block. `<` is escaped
   so no story body — which is client-typed markup by this point — can close
   the <script> tag it travels in. */
export function storiesJson(stories) {
  return JSON.stringify(stories).replace(/</g, '\\u003c');
}
