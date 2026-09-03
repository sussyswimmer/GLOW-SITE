/* Writes the page shells from one template, so the brand bar, nav and
   footer can never drift apart between them. Run: npm run pages

   Two kinds of page come out of here.

   PRIVATE (dashboard, courses, course) are SHELLS: the frame plus an
   empty #view that src/app.js fills from the API. Nothing in this file
   knows a single course title, which is the point — the client edits
   courses in Moodle, not in our HTML. They carry noindex, because there
   is nothing at those URLs for a crawler to have.

   PUBLIC (english, resources) are CATALOGUE pages, and they are built
   here with their content already in the markup. It is the same data the
   API would serve — `server/data/glow-catalogue.js`, harvested from
   glow.mata9.com without a login — so there was never a reason to make a
   visitor sign in to read it, or to hide it from search. A learner
   looking for "TOEIC practice" should be able to find GLOW that way.
   src/app.js refreshes them from the API when there IS a session, and
   otherwise leaves the static markup exactly as it is. */

import { writeFileSync } from 'node:fs';
import { GROUPS, TRACKS } from '../server/data/glow-catalogue.js';

/* Everything interpolated into the template goes through this. Most of it
   is our own copy, but the catalogue below is harvested from a system whose
   course names are typed by people. */
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* A bilingual element: authored in Vietnamese, swapped by src/i18n.js. */
const bi = (tag, vi, en) =>
  `<${tag} data-i18n data-vi="${esc(vi)}" data-en="${esc(en)}">${esc(vi)}</${tag}>`;

/* ── the catalogue, as static markup ──────────────────────
   Shaped to match renderCatalog() in src/views.js exactly, so a signed-in
   refresh from the API replaces like with like and the page does not jump.
   The group ids are real anchor targets: the homepage footer links into
   them (`./english.html#pronunciation`) rather than at a homepage section
   that only describes the thing. */
function catalogMarkup(key) {
  return GROUPS.filter(g => g.catalog === key).map(g => {
    const items = TRACKS.filter(t => t.group === g.key);
    const chips = items
      .map(t => `<a class="chip" href="./course.html?id=${t.id}">${esc(t.nav)}</a>`)
      .join('');
    return [
      `      <section class="track" id="${esc(g.key)}" data-rise>`,
      '        <div class="track-head">',
      `          ${bi('h3', g.titleVi, g.title)}`,
      `          <span class="count">${items.length}</span>`,
      '        </div>',
      `        <div class="chips">${chips}</div>`,
      '      </section>',
    ].join('\n');
  }).join('\n');
}

const shell = ({
  file, titleVi, titleEn, descVi, descEn,
  h1, h1en, sub, suben, crumbs, main,
  noindex = true, isPublic = false,
  /* Which script boots the page. Everything used to be src/app.js; the
     story reader has its own, smaller entry. */
  entry = './src/app.js',
  /* Which <noscript> note the page gets. A public catalogue page is fully
     readable without JavaScript; the story reader is public but renders
     its content after load, so it fails the private way. */
  needsJs = !isPublic,
}) => `<!DOCTYPE html>
<html lang="vi"
      data-title-vi="${esc(titleVi)}" data-title-en="${esc(titleEn)}"
      data-desc-vi="${esc(descVi)}" data-desc-en="${esc(descEn)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#F9F9F9">
<!-- Vietnamese is the authored language and the one the UI renders first, so
     it is the one in the markup. src/i18n.js rewrites this title, the
     description and <html lang> together from the data-* attributes above
     when the learner switches to English — the page used to render a
     Vietnamese interface under an English title in both languages. -->
<title>${esc(titleVi)}</title>
<meta name="description" content="${esc(descVi)}">
${noindex
  ? '<meta name="robots" content="noindex">'
  : `<link rel="canonical" href="https://glow-pacific-links.netlify.app/${file}">`}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anybody:wght@600;700;800&family=Roboto:wght@300;400;500;700&display=swap">
<link rel="stylesheet" href="./src/styles.css">
<link rel="stylesheet" href="./src/app.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23014E45'/%3E%3Ccircle cx='16' cy='16' r='11' fill='%23B7EAE7'/%3E%3Ccircle cx='16' cy='16' r='7.4' fill='%2340D3BA'/%3E%3Ccircle cx='16' cy='16' r='3.4' fill='%2314BA76'/%3E%3C/svg%3E">
</head>
<body class="app">

<a class="skip-link" href="#view" data-i18n data-vi="Tới nội dung chính" data-en="Skip to main content">Tới nội dung chính</a>

<!-- ══════ BRAND BAR ══════ -->
<header class="appbar">
  <div class="appbar-in">
    <a class="logo" href="./index.html"><img src="./assets/img/glow-logo.png" alt="GLOW — Growing Learning Opportunities Worldwide" width="120" height="40"></a>
    <span class="appbar-spacer"></span>
    <button id="langBtn" class="lang" type="button" aria-pressed="false" aria-label="Language / Ngôn ngữ">
      <span class="lang-vi">VI</span><span class="lang-sep"> · </span><span class="lang-en">EN</span>
    </button>

    <!-- SIGNED OUT is the state in the markup, because it is the state a
         crawler, a link preview and a first-time visitor are all actually in.
         The shell used to ship an em dash where the name goes, a middle dot
         for the avatar and a "Sign out" button beside them, so every page
         rendered a header belonging to a learner who was not there — and
         offered to sign out a visitor who had never signed in. src/app.js
         turns these over once, and only once, it has a session in hand. -->
    <a class="who" href="./dashboard.html" hidden>
      <span class="who-name"></span>
      <span class="avatar" aria-hidden="true"></span>
    </a>
    <button id="signOut" class="signout" type="button" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
      <span data-i18n data-vi="Đăng xuất" data-en="Sign out">Đăng xuất</span>
    </button>
    <a id="signIn" class="signout" href="./login.html">
      <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/></svg>
      <span data-i18n data-vi="Đăng nhập" data-en="Sign in">Đăng nhập</span>
    </a>
  </div>
</header>

<!-- ══════ NAV ══════
     The home link used to be an icon and nothing else. An icon-only link has
     no text, and everything that reads a page by its text — a crawler, a
     link audit, a reader-mode extraction — falls back to printing the href,
     so the first item in the navigation read "./index.html". It has a word
     now, and the icon is decoration beside it.

     data-private marks the two items that only mean anything with a session.
     On a public page they start hidden and src/app.js reveals them if there
     is one; on a private page they are always there, because you cannot be
     looking at one of those signed out. -->
<nav class="appnav" aria-label="Main">
  <div class="appnav-in">
    <a href="./index.html" data-page="index.html">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
      <span data-i18n data-vi="Trang chủ" data-en="Home">Trang chủ</span>
    </a>
    <a href="./dashboard.html" data-page="dashboard.html" data-private${isPublic ? ' hidden' : ''} data-i18n data-vi="Bảng điều khiển" data-en="Dashboard">Bảng điều khiển</a>
    <a href="./courses.html" data-page="courses.html" data-private${isPublic ? ' hidden' : ''} data-i18n data-vi="Khoá học của tôi" data-en="My courses">Khoá học của tôi</a>
    <a href="./english.html" data-page="english.html" data-i18n data-vi="Học tiếng Anh" data-en="English self-learning">Học tiếng Anh</a>
    <a href="./resources.html" data-page="resources.html" data-i18n data-vi="Tài nguyên giáo dục" data-en="Educational Resources">Tài nguyên giáo dục</a>
    <a href="./stories.html" data-page="stories.html" data-i18n data-vi="Tin tức" data-en="Stories">Tin tức</a>
  </div>
</nav>

<!-- ══════ PAGE HEAD ══════ -->
<div class="pagehead">
  <div class="pagehead-in">
    ${crumbs ? `<nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>` : ''}
    <h1 data-i18n data-vi="${esc(h1)}" data-en="${esc(h1en)}">${esc(h1)}</h1>
    ${sub ? `<p data-i18n data-vi="${esc(sub)}" data-en="${esc(suben)}">${esc(sub)}</p>` : ''}
  </div>
</div>

${main}

<!-- Written in both languages, always — the VI/EN toggle is itself a script,
     so a reader without JavaScript is stuck in whichever language the markup
     shipped in, and telling them so in only that language is no help at all.

     Two versions, because the two kinds of page fail differently. A private
     shell without JavaScript is an empty #view under a heading, and needs to
     say why. A public catalogue page is completely readable without it and
     loses only the toggle, so claiming it is broken would be a lie. -->
<noscript>
  <div class="noscript-note" role="note">${!needsJs ? `
    <p><strong>JavaScript đang tắt.</strong> Bạn vẫn đọc được toàn bộ trang này, nhưng nút chuyển VI · EN sẽ không hoạt động. Bật JavaScript để đổi ngôn ngữ.</p>
    <p lang="en"><strong>JavaScript is off.</strong> You can still read this whole page, but the VI · EN switch will not work. Turn JavaScript on to change language.</p>` : `
    <p><strong>Trang này cần JavaScript.</strong> Nội dung học tập được tải sau khi trang mở, nên cần bật JavaScript. Hãy bật JavaScript rồi tải lại trang — hoặc mở thẳng <a href="https://glow.mata9.com">glow.mata9.com</a>.</p>
    <p lang="en"><strong>This page needs JavaScript.</strong> Its learning content is loaded after the page opens, so JavaScript has to be enabled. Please turn it on and reload — or go straight to <a href="https://glow.mata9.com">glow.mata9.com</a>.</p>`}
  </div>
</noscript>

<footer class="appfoot">
  <div class="appfoot-in">
    <span>© 2026 Pacific Links Foundation</span>
    <span><a href="./index.html">GLOW</a> — Growing Learning Opportunities Worldwide</span>
  </div>
</footer>

<script type="module" src="${entry}"></script>
</body>
</html>
`;

/* Breadcrumb pieces. A public page's trail starts at the public home page,
   not at the dashboard — sending a signed-out reader "up" to a page that
   will bounce them to sign in is not a trail. */
const crumbHome = '<a href="./index.html" data-i18n data-vi="Trang chủ" data-en="Home">Trang chủ</a>';
const crumbDash = '<a href="./dashboard.html" data-i18n data-vi="Bảng điều khiển" data-en="Dashboard">Bảng điều khiển</a>';
const sep = '<span aria-hidden="true">/</span>';

const PAGES = [
  {
    file: 'dashboard.html',
    titleVi: 'Bảng điều khiển | GLOW', titleEn: 'Dashboard | GLOW',
    descVi: 'Tiếp tục từ chỗ bạn đang học trên GLOW.',
    descEn: 'Pick up where you left off on GLOW.',
    h1: 'Bảng điều khiển', h1en: 'Dashboard',
    sub: 'Tiếp tục từ chỗ bạn đang học, và xem những gì sắp tới.',
    suben: "Pick up where you left off, and see what's coming up.",
    main: '<main class="shell shell-2col" id="view" tabindex="-1"></main>',
  },
  {
    file: 'courses.html',
    titleVi: 'Khoá học của tôi | GLOW', titleEn: 'My courses | GLOW',
    descVi: 'Mọi khoá học bạn đang tham gia trên GLOW.',
    descEn: 'Every course you are enrolled in on GLOW.',
    h1: 'Khoá học của tôi', h1en: 'My courses',
    sub: 'Mọi khoá học bạn đang tham gia.',
    suben: 'Every course you are enrolled in.',
    crumbs: crumbDash + sep + '<span data-i18n data-vi="Khoá học của tôi" data-en="My courses">Khoá học của tôi</span>',
    main: '<main class="shell" id="view" tabindex="-1"></main>',
  },
  {
    file: 'course.html',
    titleVi: 'Khoá học | GLOW', titleEn: 'Course | GLOW',
    descVi: 'Nội dung khoá học trên GLOW.', descEn: 'Course content on GLOW.',
    /* Replaced by the real course name once it loads — see renderCourse in
       src/views.js, and courseHeading() in src/app.js for the cases where it
       never does. The shell used to sit on "Đang tải…" for ever if the fetch
       failed, under a title reading "Course | GLOW". */
    h1: 'Đang tải…', h1en: 'Loading…',
    /* The last crumb used to be an empty <span>, so the trail ended in a
       slash with nothing after it. It names what is loading now, and the
       course name replaces the word. */
    crumbs: crumbDash + sep
      + '<a href="./courses.html" data-i18n data-vi="Khoá học của tôi" data-en="My courses">Khoá học của tôi</a>' + sep
      + '<span class="crumb-now" data-i18n data-vi="Khoá học" data-en="Course">Khoá học</span>',
    main: '<main class="shell" id="view" tabindex="-1"></main>',
  },
  {
    file: 'english.html',
    titleVi: 'Học tiếng Anh | GLOW', titleEn: 'English self-learning | GLOW',
    descVi: 'Các lộ trình tự học tiếng Anh miễn phí trên GLOW: TED Talks, phát âm, ETOP, luyện thi TOEIC và IELTS — chia theo trình độ.',
    descEn: 'Free English self-study tracks on GLOW: TED Talks, pronunciation, ETOP, TOEIC and IELTS preparation — split by level.',
    h1: 'Học tiếng Anh', h1en: 'English self-learning',
    sub: 'Các lộ trình tự học, chia theo trình độ để bạn bắt đầu đúng chỗ.',
    suben: 'Self-study tracks, split by level so you start in the right place.',
    crumbs: crumbHome + sep + '<span data-i18n data-vi="Học tiếng Anh" data-en="English self-learning">Học tiếng Anh</span>',
    main: `<main class="shell" id="view" tabindex="-1">\n${catalogMarkup('english')}\n</main>`,
    noindex: false, isPublic: true,
  },
  {
    file: 'resources.html',
    titleVi: 'Tài nguyên giáo dục | GLOW', titleEn: 'Educational Resources | GLOW',
    descVi: 'Công cụ và tài liệu hỗ trợ tự học trên GLOW: chatbot AI, mẹo tự học, báo cáo thời gian học và Khan Academy.',
    descEn: 'Tools and material that support self-study on GLOW: AI chatbots, self-learning tips, study-time reporting and Khan Academy.',
    h1: 'Tài nguyên giáo dục', h1en: 'Educational Resources',
    sub: 'Công cụ và tài liệu hỗ trợ việc tự học.',
    suben: 'Tools and material that support self-study.',
    crumbs: crumbHome + sep + '<span data-i18n data-vi="Tài nguyên giáo dục" data-en="Educational Resources">Tài nguyên giáo dục</span>',
    main: `<main class="shell" id="view" tabindex="-1">\n${catalogMarkup('resources')}\n</main>`,
    noindex: false, isPublic: true,
  },
  /* ── STORIES — the CMS's own pages ──────────────────────
     The one part of the site whose content comes from neither Moodle nor
     this repository's authors: content/stories/*.md, written by Pacific
     Links through the CMS at /admin.

     The LISTING is static, like the catalogue pages: the <!--@stories-->
     marker below is replaced by tools/content-plugin.mjs at dev-serve and
     build time, so the page is indexable and readable with JavaScript off.

     The READER follows course.html's own pattern — one shell, ?slug= in
     the query, rendered on the client. Its data travels IN the page as an
     inline JSON block (the <!--@stories-json--> marker), so it works
     without a server and without loosening the CSP's connect-src. */
  {
    file: 'stories.html',
    titleVi: 'Tin tức | GLOW', titleEn: 'Stories | GLOW',
    descVi: 'Thông báo, câu chuyện học viên và tin tức từ GLOW — nền tảng tự học miễn phí của Pacific Links Foundation.',
    descEn: 'Announcements, learner stories and news from GLOW — the free self-learning platform from Pacific Links Foundation.',
    h1: 'Tin tức', h1en: 'Stories',
    sub: 'Thông báo, câu chuyện học viên và tin tức từ GLOW.',
    suben: 'Announcements, learner stories and news from GLOW.',
    crumbs: crumbHome + sep + '<span data-i18n data-vi="Tin tức" data-en="Stories">Tin tức</span>',
    main: [
      '<main class="shell" id="view" tabindex="-1">',
      '      <section class="stories" data-rise>',
      '        <!--@stories-->',
      '      </section>',
      '</main>',
    ].join('\n'),
    noindex: false, isPublic: true,
  },
  {
    file: 'story.html',
    titleVi: 'Bài viết | GLOW', titleEn: 'Story | GLOW',
    descVi: 'Bài viết từ GLOW.', descEn: 'A story from GLOW.',
    /* Replaced by the story's own title once src/story.js finds it — the
       same contract as course.html's "Đang tải…". */
    h1: 'Đang tải…', h1en: 'Loading…',
    crumbs: crumbHome + sep
      + '<a href="./stories.html" data-i18n data-vi="Tin tức" data-en="Stories">Tin tức</a>' + sep
      + '<span class="crumb-now" data-i18n data-vi="Bài viết" data-en="Story">Bài viết</span>',
    main: [
      '<main class="shell" id="view" tabindex="-1">',
      '  <article class="story-article" id="story"></article>',
      '</main>',
      '<script type="application/json" id="glowStories"><!--@stories-json--></script>',
    ].join('\n'),
    isPublic: true, needsJs: true,
    entry: './src/story.js',
  },
];

for (const page of PAGES) {
  writeFileSync(page.file, shell(page), 'utf8');
  console.log(`wrote ${page.file}${page.isPublic ? '  (public, content inlined)' : ''}`);
}
console.log(`\n${PAGES.length} pages written.`);
