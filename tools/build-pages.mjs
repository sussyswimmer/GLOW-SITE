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
import { CATEGORIES, GROUPS as CAT_GROUPS, catalogueFor } from '../server/data/catalogue.js';

/* The course catalogue, signed out: role null is public courses only, so
   nothing role-gated can reach the static HTML. */
const PUBLIC = catalogueFor(null);

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

/* ── the course catalogue, as static markup ────────────────
   The same class names and element shape as src/views/catalogue.js, so the
   API's version replaces this one without the page moving. A name that exists
   in one language only is written once, not as a fake translation. */
const bs = (vi, en) => (vi && vi !== en ? `<span data-i18n data-vi="${esc(vi)}" data-en="${esc(en)}">${esc(vi)}</span>` : esc(en));
const bt = (tag, cls, vi, en) => `<${tag} class="${cls}">${bs(vi, en)}</${tag}>`;

const ACCESS_LABEL = { gems: ['Học bổng GEMS', 'GEMS scholars'], seeds: ['Học bổng SEEDS', 'SEEDS scholars'], staff: ['Nhân viên', 'Staff'] };

function cardHtml(c) {
  const cat = CATEGORIES.find(k => k.key === c.cat);
  const a = ACCESS_LABEL[c.access];
  return `<a class="ccard" href="./course.html?code=${esc(encodeURIComponent(c.code))}">`
    + `${bt('span', 'ccard-name', c.vi, c.en)}<span class="ccard-top"><span class="ccode"><span class="sr-only" data-i18n data-vi="Mã khoá học: " data-en="Course code: ">Mã khoá học: </span>${esc(c.code)}</span>`
    + `${a ? `<span class="cbadge">${bs(a[0], a[1])}</span>` : ''}</span>`
    + `${bt('span', 'ccard-cat', cat.vi, cat.en)}</a>`;
}
const gridHtml = list => `<div class="cgrid">${list.map(cardHtml).join('')}</div>`;

/* courses.html: category cards, then every public course grouped by category. */
function coursesIndexMarkup() {
  const cards = PUBLIC.categories.map(c => {
    const n = PUBLIC.courses.filter(x => x.cat === c.key).length;
    return `      <a class="catcard" href="./${c.page}"><span class="catcard-name">${bs(c.vi, c.en)}</span>`
      + `<span class="catcard-blurb">${bs(c.blurbVi, c.blurbEn)}</span>`
      + `<span class="catcard-n"><span data-i18n data-vi="${n} khoá học" data-en="${n} courses">${n} khoá học</span></span></a>`;
  }).join('\n');
  const groups = PUBLIC.categories.map(c => {
    const list = PUBLIC.courses.filter(x => x.cat === c.key);
    return `      <section class="cgroup-block">\n        <div class="sec-head"><h2>${bs(c.vi, c.en)}</h2><span class="count">${list.length}</span></div>\n        ${gridHtml(list)}\n      </section>`;
  }).join('\n');
  return `<main class="shell" id="view" tabindex="-1">\n      <div class="catcards">\n${cards}\n      </div>\n${groups}\n</main>`;
}

/* english.html / skills.html: one section per sub-category, id = its key. */
function categoryMarkup(catKey) {
  const sections = PUBLIC.subcategories.filter(s => s.cat === catKey).map(s => {
    const courses = PUBLIC.courses.filter(c => c.sub === s.key);
    if (!courses.length) return '';
    const parts = [`      <section class="catsec" id="${esc(s.key)}">`,
      `        <div class="catsec-head"><h2>${bs(s.vi, s.en)}</h2><span class="count">${courses.length}</span></div>`];
    if (s.descVi || s.descEn) parts.push(`        <p class="catsec-desc">${bs(s.descVi || s.descEn, s.descEn || s.descVi)}</p>`);
    if (s.key === 'english-self-learning') {
      parts.push('        <a class="feature" href="./lessons.html">'
        + `<span class="feature-title">${bs('Bài học tiếng Anh qua tin tức', 'English through the news')}</span>`
        + `<span class="feature-desc">${bs('Bài đọc mỗi ngày có audio, từ khoá và sổ từ vựng.', 'Daily lessons with audio, keywords and a word bank.')}</span>`
        + `<span class="feature-go">${bs('Đọc bài học', 'Read the lessons')} →</span></a>`);
    }
    const loose = courses.filter(c => !c.group);
    if (loose.length) parts.push('        ' + gridHtml(loose));
    for (const g of CAT_GROUPS.filter(x => x.sub === s.key)) {
      const list = courses.filter(c => c.group === g.key);
      if (list.length) parts.push(`        <div class="cgroup">${bt('h3', 'cgroup-title', g.vi, g.en)}${gridHtml(list)}</div>`);
    }
    parts.push('      </section>');
    return parts.join('\n');
  }).filter(Boolean).join('\n');
  return `<main class="shell" id="view" tabindex="-1">\n${sections}\n</main>`;
}

/* ── the chrome, written once ─────────────────────────────
   Header menu and footer for every shell page. index.html carries its own
   copy of the same items (its words come from content/landing.json), so a
   change to the menu or the footer links is made in both places. The
   behaviour lives in src/nav.js either way. */
const ICON = {
  chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
};

const link = (href, vi, en, extra = '') =>
  `<a href="${href}"${extra} data-i18n data-vi="${esc(vi)}" data-en="${esc(en)}">${esc(vi)}</a>`;

/* Training is for staff only: it ships hidden, and src/nav.js reveals it. */
const COURSES_MENU = [
  ['./courses.html', 'Tất cả khoá học', 'All courses'],
  ['./english.html', 'Học tiếng Anh', 'English Learning'],
  ['./skills.html', 'Kỹ năng & Kết nối', 'Skills & Network Building'],
  ['./training.html', 'Đào tạo nội bộ', 'Training', true],
].map(([h, vi, en, staff]) => '        ' + link(h, vi, en, staff ? ' data-staff hidden' : '')).join('\n');

const SEARCH = `<div class="navsearch-wrap">
      <a class="navsearch-btn" href="./courses.html">${ICON.search}<span class="sr-only" data-i18n data-vi="Tìm khoá học" data-en="Search courses">Tìm khoá học</span></a>
      <form class="navsearch" id="navSearch" role="search" action="./courses.html" method="get" hidden>
        <label for="navQ" data-i18n data-vi="Tìm khoá học (tên tiếng Anh hoặc tiếng Việt)" data-en="Search courses (English or Vietnamese names)">Tìm khoá học (tên tiếng Anh hoặc tiếng Việt)</label>
        <div class="navsearch-row">
          <input id="navQ" name="q" type="search" autocomplete="off">
          <button type="submit" data-i18n data-vi="Tìm" data-en="Search">Tìm</button>
        </div>
      </form>
    </div>`;

const EXT = ' target="_blank" rel="noopener noreferrer"';
const PL = 'https://pacificlinks.org';
const FOOT_COLS = [
  { vi: 'Học tiếng Anh', en: 'English Learning', links: [
    ['./english.html#english-testing', 'Kiểm tra tiếng Anh', 'English Testing'],
    ['./english.html#english-self-learning', 'Tự học tiếng Anh', 'English Self-Learning'],
    ['./english.html#etop', 'ETOP', 'ETOP'],
    ['./english.html#english-resources', 'Tài nguyên tiếng Anh', 'English Resources'],
  ] },
  { vi: 'Kỹ năng & Kết nối', en: 'Skills & Network Building', links: [
    ['./skills.html#coffeetime', 'CoffeeTime', 'CoffeeTime'],
    ['./skills.html#mentoring', 'Cố vấn', 'Mentoring'],
    ['./skills.html#career-track', 'Lộ trình phát triển nghề nghiệp', 'Career Development Track'],
    ['./skills.html#youth-empowerment', 'Chuỗi khoá học Trao quyền cho Thanh niên', 'Youth Empowerment Series'],
  ] },
  { vi: 'Đào tạo nội bộ', en: 'Training', staff: true, links: [
    ['./training.html#staff-english', 'Tiếng Anh cho nhân viên', 'English for staff'],
    ['./training.html#migration-trafficking', 'Phòng ngừa rủi ro di cư & mua bán người', 'Migration & trafficking prevention'],
    ['./training.html#organization-skills', 'Kỹ năng tổ chức', 'Organisation skills'],
    ['./training.html#technical-skills', 'Kỹ năng công nghệ', 'Technical skills'],
  ] },
  { vi: 'Khác', en: 'Other', links: [
    ['./stories.html', 'Tin tức', 'Stories'],
    ['./index.html#about', 'Về GLOW', 'About GLOW'],
    ['./login.html', 'Đăng nhập', 'Sign in', ' data-guest'],
    [PL, 'Trở thành tình nguyện viên', 'Become a Volunteer', EXT],
    [PL, 'Quyên góp', 'Donate', EXT],
    [PL, 'Hợp tác cùng chúng tôi', 'Partner With Us', EXT],
    ['https://mypalo.vn', 'Ứng dụng PAXU', 'PAXU app', EXT],
  ] },
];

const FOOTER = `<footer class="foot">
  <div class="foot-in">
    <div class="foot-brand">
      <a class="logo" href="./index.html"><img src="./assets/img/glow-logo.png" alt="GLOW — Growing Learning Opportunities Worldwide" width="550" height="90"></a>
      <p data-i18n data-vi="Nền tảng tự học của Pacific Links Foundation, hợp tác cùng Matera." data-en="The self-learning platform from Pacific Links Foundation, in partnership with Matera.">Nền tảng tự học của Pacific Links Foundation, hợp tác cùng Matera.</p>
    </div>
    <div class="foot-cols">
${FOOT_COLS.map(c => `      <div${c.staff ? ' data-staff hidden' : ''}>
        ${bi('h3', c.vi, c.en)}
${c.links.map(([h, vi, en, x = '']) => '        ' + link(h, vi, en, x)).join('\n')}
      </div>`).join('\n')}
    </div>
  </div>
  <div class="foot-rule">
    <span>© 2026 Pacific Links Foundation</span>
    <span>GLOW — Growing Learning Opportunities Worldwide</span>
  </div>
  <div class="bands foot-bands" aria-hidden="true"></div>
</footer>`;

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
    <a class="logo" href="./index.html"><img src="./assets/img/glow-logo.png" alt="GLOW — Growing Learning Opportunities Worldwide" width="550" height="90"></a>
    <p class="partner" data-i18n data-vi="Hợp tác cùng Pacific Links Foundation & Matera" data-en="In partnership with Pacific Links Foundation & Matera">Hợp tác cùng Pacific Links Foundation & Matera</p>
    <span class="appbar-spacer"></span>
    ${SEARCH}
    <button id="langBtn" class="lang" type="button" aria-pressed="false" aria-label="Language / Ngôn ngữ">
      <span class="lang-vi">VI</span><span class="lang-sep"> · </span><span class="lang-en">EN</span>
    </button>

    <!-- SIGNED OUT is the state in the markup, because it is the state a
         crawler, a link preview and a first-time visitor are all actually in.
         src/nav.js (applyAuth) turns these over once, and only once, it has
         a session in hand: the chip reads "<learner code> <full name>", or
         "Staff" for an account with no code. -->
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
     Home · Dashboard · Courses ▼ · Tuition. Dashboard is in the public menu
     on purpose (the brief keeps it there): signed out, it sends you to sign
     in. Tuition is not in the brief's menu; it stays because it was asked
     for in every menu. English self-learning, Resources and Stories are no
     longer here: they live under Courses and in the footer.
     The Training entry is data-staff: hidden until src/nav.js sees a staff
     session. -->
<nav class="appnav" aria-label="Main">
  <div class="appnav-in">
    <a href="./index.html" data-page="index.html">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
      <span data-i18n data-vi="Trang chủ" data-en="Home">Trang chủ</span>
    </a>
    <a href="./dashboard.html" data-page="dashboard.html" data-i18n data-vi="Bảng điều khiển" data-en="Dashboard">Bảng điều khiển</a>
    <div class="navdd">
      <button class="navdd-btn" type="button" aria-expanded="false" aria-controls="coursesMenu">
        <span data-i18n data-vi="Khoá học" data-en="Courses">Khoá học</span>${ICON.chev}
      </button>
      <div class="navdd-menu" id="coursesMenu" hidden>
${COURSES_MENU}
      </div>
    </div>
    <a href="./payment.html" data-page="payment.html" data-i18n data-vi="Học phí" data-en="Tuition">Học phí</a>
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

${FOOTER}

<script type="module" src="${entry}"></script>
</body>
</html>
`;

/* Breadcrumb pieces. A public page's trail starts at the public home page,
   not at the dashboard — sending a signed-out reader "up" to a page that
   will bounce them to sign in is not a trail. */
const crumbHome = '<a href="./index.html" data-i18n data-vi="Trang chủ" data-en="Home">Trang chủ</a>';
const crumbCourses = '<a href="./courses.html" data-i18n data-vi="Khoá học" data-en="Courses">Khoá học</a>';
const crumbDash ='<a href="./dashboard.html" data-i18n data-vi="Bảng điều khiển" data-en="Dashboard">Bảng điều khiển</a>';
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
    /* .dash, not .shell-2col: the dashboard lays out its own cards in DOM
       order = phone order, and a separate rail column would push the tuition
       card below every course tile on a phone. */
    main: '<main class="shell dash" id="view" tabindex="-1"></main>',
  },
  {
    /* PUBLIC: what GLOW costs is something to read before joining, not after.
       Rendered after load (signed in or not), so it fails the private way
       without JavaScript — hence needsJs. */
    file: 'payment.html',
    titleVi: 'Học phí và thanh toán | GLOW', titleEn: 'Tuition and payment | GLOW',
    descVi: 'Học phí GLOW, những gì học phí bao gồm, cách thanh toán và cách xin hỗ trợ học phí.',
    descEn: "GLOW's tuition, what it covers, how to pay, and how to ask for fee support.",
    h1: 'Học phí và thanh toán', h1en: 'Tuition and payment',
    sub: 'Học phí, những gì học phí bao gồm, và cách xin hỗ trợ học phí nếu bạn cần.',
    suben: "The tuition, what it covers, and how to ask for fee support if you need it.",
    crumbs: crumbHome + sep + '<span data-i18n data-vi="Học phí và thanh toán" data-en="Tuition and payment">Học phí và thanh toán</span>',
    main: '<main class="shell pay" id="view" tabindex="-1"></main>',
    noindex: false, isPublic: true, needsJs: true,
  },
  {
    file: 'courses.html',
    titleVi: 'Khoá học | GLOW', titleEn: 'Courses | GLOW',
    descVi: 'Tất cả khoá học trên GLOW: Học tiếng Anh, Kỹ năng & Kết nối.',
    descEn: 'All GLOW courses: English Learning and Skills & Network Building.',
    h1: 'Khoá học', h1en: 'Courses',
    sub: 'Tất cả khoá học trên GLOW, chia thành ba danh mục: Học tiếng Anh, Kỹ năng & Kết nối và Đào tạo nội bộ.',
    suben: 'All GLOW courses, in three categories: English Learning, Skills & Network Building, and Training.',
    crumbs: crumbHome + sep + '<span data-i18n data-vi="Khoá học" data-en="Courses">Khoá học</span>',
    main: coursesIndexMarkup(),
    noindex: false, isPublic: true,
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
    crumbs: crumbHome + sep
      + '<a href="./courses.html" data-i18n data-vi="Khoá học" data-en="Courses">Khoá học</a>' + sep
      + '<span class="crumb-now" data-i18n data-vi="Khoá học" data-en="Course">Khoá học</span>',
    main: '<main class="shell" id="view" tabindex="-1"></main>',
  },
  {
    file: 'english.html',
    titleVi: 'Học tiếng Anh | GLOW', titleEn: 'English Learning | GLOW',
    descVi: 'Kiểm tra trình độ, tự học (TED Talks, phát âm, ngữ pháp, từ vựng), gia sư ETOP và tài nguyên tiếng Anh trên GLOW.',
    descEn: 'English testing, self-learning (TED Talks, pronunciation, grammar, vocabulary), ETOP tutoring and English resources on GLOW.',
    h1: 'Học tiếng Anh', h1en: 'English Learning',
    sub: 'Các lộ trình tự học, chia theo trình độ để bạn bắt đầu đúng chỗ.',
    suben: 'Self-study tracks, split by level so you start in the right place.',
    crumbs: crumbHome + sep + crumbCourses + sep + '<span data-i18n data-vi="Học tiếng Anh" data-en="English Learning">Học tiếng Anh</span>',
    main: categoryMarkup('english'),
    noindex: false, isPublic: true,
  },
  {
    file: 'skills.html',
    titleVi: 'Kỹ năng & Kết nối | GLOW', titleEn: 'Skills & Network Building | GLOW',
    descVi: 'CoffeeTime, cố vấn, lộ trình nghề nghiệp, chuỗi khoá học Trao quyền cho Thanh niên và di cư an toàn trên GLOW.',
    descEn: 'CoffeeTime talks, mentoring, career tracks, the Youth Empowerment Series and safe migration on GLOW.',
    h1: 'Kỹ năng & Kết nối', h1en: 'Skills & Network Building',
    sub: 'Các buổi trò chuyện, cố vấn, lộ trình nghề nghiệp và khoá học tự học giúp bạn phát triển kỹ năng và mở rộng mạng lưới.',
    suben: 'Talks, mentoring, career tracks and self-paced courses to build skills and grow your network.',
    crumbs: crumbHome + sep + crumbCourses + sep + '<span data-i18n data-vi="Kỹ năng & Kết nối" data-en="Skills & Network Building">Kỹ năng & Kết nối</span>',
    main: categoryMarkup('skills'),
    noindex: false, isPublic: true,
  },
  {
    /* STAFF ONLY. No course data in this markup: what is here is the panel a
       signed-out visitor or a non-staff learner should see. src/app.js
       replaces it with the Training courses only for a staff session. */
    file: 'training.html',
    titleVi: 'Đào tạo nội bộ | GLOW', titleEn: 'Training | GLOW',
    descVi: 'Đào tạo dành cho nhân viên và đối tác Pacific Links.', descEn: 'Training for Pacific Links staff and partners.',
    h1: 'Đào tạo nội bộ', h1en: 'Training',
    sub: 'Đào tạo dành cho nhân viên và đối tác Pacific Links.',
    suben: 'Training for Pacific Links staff and partners.',
    crumbs: crumbHome + sep + crumbCourses + sep + '<span data-i18n data-vi="Đào tạo nội bộ" data-en="Training">Đào tạo nội bộ</span>',
    main: [
      '<main class="shell" id="view" tabindex="-1">',
      '  <section class="panel staff-gate">',
      '    <p data-i18n data-vi="Trang này dành cho nhân viên Pacific Links. Hãy đăng nhập bằng tài khoản nhân viên." data-en="This page is for Pacific Links staff. Please sign in with a staff account.">Trang này dành cho nhân viên Pacific Links. Hãy đăng nhập bằng tài khoản nhân viên.</p>',
      '    <p><a class="btn btn-primary" href="./login.html?next=training.html" data-i18n data-vi="Đăng nhập" data-en="Sign in">Đăng nhập</a></p>',
      '  </section>',
      '</main>',
    ].join('\n'),
    isPublic: true, needsJs: true,
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
    descVi: 'Thông báo, câu chuyện học viên và tin tức từ GLOW — nền tảng tự học của Pacific Links Foundation.',
    descEn: 'Announcements, learner stories and news from GLOW — the self-learning platform from Pacific Links Foundation.',
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
  /* ── LESSONS — English through the news ─────────────────
     Same pattern as stories: static listing (<!--@lessons-->), reader with
     its data inlined (<!--@lessons-json-->). One entry, src/lessons.js,
     serves the list and the reader. The Studio is staff-only and noindex. */
  {
    file: 'lessons.html',
    titleVi: 'Tiếng Anh qua tin tức | GLOW', titleEn: 'English through the news | GLOW',
    descVi: 'Bài đọc tiếng Anh theo cấp độ, có nghe, từ khoá kèm nghĩa tiếng Việt và sổ từ vựng.',
    descEn: 'Graded English reading with listening, keywords with Vietnamese meanings and a word bank.',
    h1: 'Tiếng Anh qua tin tức', h1en: 'English through the news',
    sub: 'Đọc, nghe và học từ mới qua những bài đọc theo cấp độ.',
    suben: 'Read, listen and learn new words through graded reading.',
    crumbs: crumbHome + sep + '<span data-i18n data-vi="Tiếng Anh qua tin tức" data-en="English through the news">Tiếng Anh qua tin tức</span>',
    main: [
      '<main class="shell" id="view" tabindex="-1">',
      '  <div class="lessons-bar">',
      '    <div class="lesson-filter" id="lessonFilter" role="group" aria-label="Lọc theo cấp độ / Filter by level" hidden>',
      '      <button type="button" class="chip" data-filter="all" aria-pressed="true" data-i18n data-vi="Tất cả" data-en="All">Tất cả</button>',
      '      <button type="button" class="chip" data-filter="beginner" aria-pressed="false" data-i18n data-vi="Cơ bản" data-en="Beginner">Cơ bản</button>',
      '      <button type="button" class="chip" data-filter="intermediate" aria-pressed="false" data-i18n data-vi="Trung cấp" data-en="Intermediate">Trung cấp</button>',
      '      <button type="button" class="chip" data-filter="advanced" aria-pressed="false" data-i18n data-vi="Nâng cao" data-en="Advanced">Nâng cao</button>',
      '    </div>',
      '    <a class="btn btn-quiet lessons-studio" href="./lesson-studio.html" data-staff hidden data-i18n data-vi="Lesson Studio (nhân viên)" data-en="Lesson Studio (staff)">Lesson Studio (nhân viên)</a>',
      '  </div>',
      '  <section class="lessons" id="lessonList">',
      '    <!--@lessons-->',
      '  </section>',
      '  <p class="stories-empty" id="lessonNone" hidden data-i18n data-vi="Chưa có bài học ở cấp độ này." data-en="No lessons at this level yet.">Chưa có bài học ở cấp độ này.</p>',
      '</main>',
    ].join('\n'),
    noindex: false, isPublic: true,
    entry: './src/lessons.js',
  },
  {
    file: 'lesson.html',
    titleVi: 'Bài học | GLOW', titleEn: 'Lesson | GLOW',
    descVi: 'Bài đọc tiếng Anh từ GLOW.', descEn: 'An English reading lesson from GLOW.',
    h1: 'Đang tải…', h1en: 'Loading…',
    crumbs: crumbHome + sep
      + '<a href="./lessons.html" data-i18n data-vi="Tiếng Anh qua tin tức" data-en="English through the news">Tiếng Anh qua tin tức</a>' + sep
      + '<span class="crumb-now" data-i18n data-vi="Bài học" data-en="Lesson">Bài học</span>',
    main: [
      '<main class="shell" id="view" tabindex="-1">',
      '  <div class="lesson" id="lesson"></div>',
      '</main>',
      '<script type="application/json" id="glowLessons"><!--@lessons-json--></script>',
    ].join('\n'),
    isPublic: true, needsJs: true,
    entry: './src/lessons.js',
  },
  {
    file: 'lesson-studio.html',
    titleVi: 'Lesson Studio | GLOW', titleEn: 'Lesson Studio | GLOW',
    descVi: 'Công cụ soạn bài đọc dành cho nhân viên Pacific Links.', descEn: 'A lesson drafting tool for Pacific Links staff.',
    h1: 'Lesson Studio', h1en: 'Lesson Studio',
    sub: 'Soạn bản nháp bài đọc từ nguồn tin đáng tin cậy, rồi duyệt và đăng trong CMS.',
    suben: 'Draft a reading lesson from a trusted source, then review and publish it in the CMS.',
    crumbs: crumbHome + sep
      + '<a href="./lessons.html" data-i18n data-vi="Tiếng Anh qua tin tức" data-en="English through the news">Tiếng Anh qua tin tức</a>' + sep
      + '<span data-i18n data-vi="Lesson Studio" data-en="Lesson Studio">Lesson Studio</span>',
    main: [
      '<main class="shell" id="view" tabindex="-1">',
      '  <div class="studio" id="studio"></div>',
      '</main>',
    ].join('\n'),
    isPublic: true, needsJs: true,
    entry: './src/lesson-studio.js',
  },
];

for (const page of PAGES) {
  writeFileSync(page.file, shell(page), 'utf8');
  console.log(`wrote ${page.file}${page.isPublic ? '  (public, content inlined)' : ''}`);
}
console.log(`\n${PAGES.length} pages written.`);
