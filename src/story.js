/* ═══════════════════════════════════════════════════════════
   The story reader — story.html?slug=…

   Follows course.html's pattern, with one difference: there is no API
   here. The stories were baked into the page at build time as an inline
   JSON block by tools/content-plugin.mjs, so this file only has to find
   the requested one and put it on screen.

   Bilingual bodies are rich HTML (rendered from the CMS's markdown at
   build), so they cannot ride the data-vi/data-en textContent swap the
   rest of the site uses. Both languages are in the DOM and src/app.css
   shows one by `html[lang]`, which i18n.js already maintains — the
   toggle costs no code here at all.
   ═══════════════════════════════════════════════════════════ */

import { initI18n, setDocTitle } from './i18n.js';
import { initInteractions } from './interact.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
initInteractions({ reduced });
const i18n = initI18n({ reduced });

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function stories() {
  try {
    return JSON.parse(document.getElementById('glowStories')?.textContent || '[]');
  } catch {
    return [];   // an unprocessed marker or mangled block reads as "no stories"
  }
}

/* The shell opens on "Đang tải…"; whatever happens next, these three are
   what replace it — heading, breadcrumb and document title together, the
   same contract courseHeading() keeps in src/app.js. */
function setHeading(vi, en) {
  const h1 = document.querySelector('.pagehead h1');
  if (h1) { h1.dataset.vi = vi; h1.dataset.en = en; }
  const crumbNow = document.querySelector('.crumbs .crumb-now');
  if (crumbNow) { crumbNow.dataset.vi = vi; crumbNow.dataset.en = en; }
  setDocTitle(`${vi} | GLOW`, `${en} | GLOW`);
}

const host = document.getElementById('story');
const slug = new URLSearchParams(location.search).get('slug');

if (!slug) {
  /* Arriving with no story chosen is a navigation mistake, not an error —
     send them to the list rather than showing a failure. */
  location.replace('./stories.html');
} else {
  const story = stories().find(s => s.slug === slug);

  if (!story) {
    setHeading('Không tìm thấy bài viết', 'Story not found');
    host.innerHTML = [
      '<p class="story-missing" data-i18n',
      ' data-vi="Bài viết này không tồn tại hoặc đã bị gỡ."',
      ' data-en="This story does not exist or has been taken down.">Bài viết này không tồn tại hoặc đã bị gỡ.</p>',
      '<p class="story-back"><a href="./stories.html" data-i18n data-vi="← Tất cả bài viết" data-en="← All stories">← Tất cả bài viết</a></p>',
    ].join('');
  } else {
    setHeading(story.title.vi, story.title.en);
    /* A story with no English body shows Vietnamese in both languages —
       an untranslated story beats a blank page. */
    const bodyEn = story.body.en || story.body.vi;
    host.innerHTML = [
      story.cover ? `<p class="story-hero"><img src="${esc(story.cover)}" alt=""></p>` : '',
      `<p class="story-date"><time datetime="${esc(story.date.iso)}" data-i18n data-vi="${esc(story.date.vi)}" data-en="${esc(story.date.en)}">${esc(story.date.vi)}</time></p>`,
      `<div class="story-body story-body-vi">${story.body.vi}</div>`,
      `<div class="story-body story-body-en">${bodyEn}</div>`,
      '<p class="story-back"><a href="./stories.html" data-i18n data-vi="← Tất cả bài viết" data-en="← All stories">← Tất cả bài viết</a></p>',
    ].join('\n');
  }

  /* Freshly built nodes come up in whichever language is already on
     screen, not the one they were authored in. */
  i18n.refresh();
}
