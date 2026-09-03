/* ═══════════════════════════════════════════════════════════
   The mock adapter — the same contract, served from memory.

   This exists so the entire site can be built, reviewed and tested
   before Pacific Links provisions a web-services account. It is not
   a toy: every route, every page and every piece of front-end state
   runs against this exactly as it will run against Moodle, so going
   live is a change to DATA_SOURCE and nothing else.

   WHAT IS REAL HERE AND WHAT IS NOT — this matters, because the site
   is for a foundation and demo content must never be mistaken for
   their records:

   • Real, lifted from the platform: every course code, course title,
     category and track name, and the syllabus lines. Sourced in
     CONTENT.md.
   • Not real, and marked as such: the signed-in learner, all progress
     percentages, the calendar events, and the activity rows inside a
     course. Course interiors sit behind the login and were never
     accessible, so they are illustrative structure, not their content.

   Every response from this adapter carries `demo: true`, and the UI
   shows a standing banner because of it. That flag is the only thing
   standing between a demo and a foundation believing it is looking at
   its own learners, so it is not optional and not silenceable.
   ═══════════════════════════════════════════════════════════ */

import { assertDashboard, assertCourseDetail } from './contract.js';
import { catalogGroups, trackById } from './glow-catalogue.js';

/* The one account that can sign in against the mock. Documented in
   docs/DEPLOY.md, and refused outright when DATA_SOURCE=moodle — see
   the guard in login() below. */
const DEMO_USER = 'demo';
const DEMO_PASS = 'glow-demo-2026';

const LEARNER = {
  id: 1,
  username: DEMO_USER,
  fullname: 'Học viên GLOW',
  /* First + last initial, matching the rule in moodle.js: Vietnamese names
     are family-name-first, so the last part is the given name. */
  initials: 'HG',
  idnumber: 'DEMO-0000',
};

const img = name => `/assets/img/${name}`;

/* ── the catalogue ───────────────────────────────────────────
   Codes, titles and syllabus lines are verbatim from the platform.
   `progress` is illustrative.

   THE IDS ARE GLOW'S REAL COURSE IDS, harvested by tools/crawl-public.mjs.
   That is what makes `moodlePath` below truthful: the "Open in Moodle"
   button on a demo course lands on that actual course, not on a 404.
   Names in the ETOP group are their navigation labels (their menu says
   "Beginner" under a heading of "ETOP"); those three courses are hidden
   from guests, so no fuller title was available to copy. */
const COURSES = [
  { id: 241, code: 'ETOP', title: 'ETOP Beginner', category: 'ETOP', image: img('slide2.png'),
    summary: 'One-to-one conversation practice with a volunteer.',
    summaryVi: 'Lớp hội thoại một kèm một với tình nguyện viên.',
    progress: 62, tracked: true, enrolled: true, lastAccess: daysAgo(1) },
  { id: 287, code: 'ETOP', title: 'ETOP Intermediate', category: 'ETOP', image: img('slide3.png'),
    summary: 'Build fluency and the confidence to respond.',
    summaryVi: 'Nâng cao khả năng diễn đạt và phản xạ hội thoại.',
    progress: 28, tracked: true, enrolled: true, lastAccess: daysAgo(4) },
  { id: 246, code: 'ETOP', title: 'ETOP Advanced', category: 'ETOP', image: img('slide4.png'),
    summary: 'In-depth discussion on topics and workplace scenarios.',
    summaryVi: 'Thảo luận chuyên sâu theo chủ đề và tình huống nghề nghiệp.',
    progress: 0, tracked: true, enrolled: true, lastAccess: daysAgo(21) },

  { id: 2489, code: 'EMM231', title: 'Kỹ Năng Làm Việc Nhóm', titleEn: 'Teamwork Skills',
    category: 'Upskilling Development', image: img('course-teamwork.png'),
    summary: 'Team models, running sessions, and the principles of working well together',
    summaryVi: 'Mô hình nhóm, quy trình sinh hoạt và nguyên tắc làm việc hiệu quả',
    syllabus: ['Giới thiệu chung về làm việc nhóm', 'Mô hình nhóm và quy trình tổ chức buổi sinh hoạt', 'Nguyên tắc tổ chức và làm việc nhóm hiệu quả'],
    progress: 0, tracked: true, enrolled: true },
  { id: 2487, code: 'EMM230', title: 'Kỹ Năng Giao Tiếp', titleEn: 'Communication Skills',
    category: 'Upskilling Development', image: img('course-communication.png'),
    summary: 'What effective communication is, its forms, channels and styles',
    summaryVi: 'Định nghĩa, hình thức, phương tiện và phong cách giao tiếp hiệu quả',
    syllabus: ['Định nghĩa và nội dung giao tiếp hiệu quả', 'Hình thức và phương tiện giao tiếp', 'Phong cách giao tiếp'],
    progress: 0, tracked: true, enrolled: true },
  { id: 2486, code: 'EMM232', title: 'Kỹ Năng Lãnh Đạo', titleEn: 'Leadership Skills',
    category: 'Upskilling Development', image: img('course-leadership.png'),
    summary: 'Leadership styles, the qualities of a leader, and the skills behind them',
    summaryVi: 'Các kiểu lãnh đạo, phẩm chất và kỹ năng của người dẫn dắt',
    syllabus: ['Định nghĩa về lãnh đạo', 'Các kiểu lãnh đạo và phẩm chất', 'Các kỹ năng của người lãnh đạo'],
    progress: 0, tracked: true, enrolled: true },
  { id: 2488, code: 'EMM227', title: 'Phòng, Chống Mua Bán Người', titleEn: 'Anti-Human Trafficking',
    category: 'Upskilling Development', image: img('course-antitrafficking.png'),
    summary: 'Recognise the tactics and forms of exploitation, and protect yourself and others',
    summaryVi: 'Nhận biết thủ đoạn và hình thức bóc lột, bảo vệ bản thân và người xung quanh',
    syllabus: ['Định nghĩa mua bán người', 'Nhận biết kẻ buôn người và nạn nhân, hình thức bóc lột và thủ đoạn', 'Bảo vệ bản thân và những người xung quanh'],
    progress: 0, tracked: true, enrolled: true },
  { id: 2441, code: 'EM7112', title: 'AI Từ Cơ Bản Đến Ứng Dụng', titleEn: 'AI: Basics to Application',
    category: 'Upskilling Development', image: img('course-ai.png'),
    summary: 'Understand AI and put it to practical use in everyday work',
    summaryVi: 'Hiểu AI và đưa nó vào công việc hằng ngày một cách thiết thực',
    syllabus: ['Youth Empowerment Series'],
    progress: 0, tracked: true, enrolled: true },
  { id: 2440, code: 'EM7113', title: 'Quản Lý Tài Chính', titleEn: 'Financial Management',
    category: 'Upskilling Development', image: img('course-finance.png'),
    summary: 'The foundations of personal financial management and planning',
    summaryVi: 'Nền tảng quản lý tài chính cá nhân và lập kế hoạch chi tiêu',
    syllabus: ['Youth Empowerment Series'],
    progress: 0, tracked: true, enrolled: true },
];

/* ── English self-learning and Educational Resources ─────────
   Both catalogues now come from `glow-catalogue.js`, which is generated
   from a crawl of the live platform: real course ids, their navigation
   labels in their order, and — for the twelve a guest is allowed to see
   — the real full title, category, summary and cover art.

   The ids matter beyond looking right: a chip carrying a real courseId
   opens a course page that can deep-link into the actual platform,
   instead of being a label with nothing behind it. */

/* ── course interiors ────────────────────────────────────────
   ETOP Beginner's rows are the ones that were visible from the public
   course listing. Everything else is structure, not content: a syllabus
   turned into sections so the page shape can be reviewed. None of it
   claims a destination it does not have — activities with nowhere to go
   carry no href, which the contract requires and the UI renders as
   "not yet available" rather than as a dead link. */
function sectionsFor(course) {
  if (course.category === 'ETOP') {
    return [
      { id: 1, title: 'General', activities: [
        { id: 11, title: 'ETOP Class rules for students — Nội quy tham gia lớp ETOP',
          type: 'url', typeLabel: 'Link', external: true, completion: 'done',
          href: 'https://glow.mata9.com/mod/url/view.php?id=1' },
        { id: 12, title: 'ETOP Session Scheduler', type: 'scheduler', typeLabel: 'Scheduler',
          external: true, completion: 'done', href: 'https://glow.mata9.com/mod/scheduler/view.php?id=2' },
        { id: 13, title: 'Feedback from Students — Phiếu đánh giá dành cho học viên',
          type: 'url', typeLabel: 'Link', external: true, completion: 'todo',
          href: 'https://glow.mata9.com/mod/url/view.php?id=3' },
        { id: 14, title: 'Phiếu hỗ trợ dành cho học sinh — ETOP student support form',
          type: 'url', typeLabel: 'Link', external: true, completion: 'todo',
          href: 'https://glow.mata9.com/mod/url/view.php?id=4' },
      ]},
      { id: 2, title: 'Documents', activities: [
        /* No href: these were never reachable without signing in, so the demo
           does not pretend otherwise. */
        { id: 21, title: 'ETOP Beginner — session workbook', type: 'file', typeLabel: 'File',
          external: false, completion: 'none' },
        { id: 22, title: 'Conversation topics — Chủ đề hội thoại', type: 'file', typeLabel: 'File',
          external: false, completion: 'none' },
      ]},
    ];
  }

  return (course.syllabus || ['Course content']).map((line, i) => ({
    id: i + 1,
    title: line,
    activities: [
      { id: (i + 1) * 10 + 1, title: `${line} — bài đọc`, type: 'page', typeLabel: 'Page',
        external: false, completion: 'none' },
      { id: (i + 1) * 10 + 2, title: `${line} — kiểm tra`, type: 'quiz', typeLabel: 'Quiz',
        external: false, completion: 'none' },
    ],
  }));
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/* ── the adapter surface — same six as moodle.js ─────────── */

export async function login(username, password) {
  const ok = username === DEMO_USER && password === DEMO_PASS;
  if (!ok) {
    const e = new Error('invalid_credentials');
    e.statusCode = 401;
    throw e;
  }
  return { token: 'mock-token', privateToken: null };
}

export async function getLearner() {
  return { ...LEARNER };
}

export async function getDashboard() {
  const courses = COURSES.map(stripInternal);
  return assertDashboard({
    demo: true,
    learner: { ...LEARNER },
    courses,
    recent: COURSES.filter(c => c.lastAccess)
      .sort((a, b) => new Date(b.lastAccess) - new Date(a.lastAccess))
      .slice(0, 3).map(stripInternal),
    events: [
      { id: 1, title: 'Meeting with your Student', when: soon(0), courseTitle: 'ETOP Beginner' },
      { id: 2, title: 'ETOP Intermediate — session', when: soon(6), courseTitle: 'ETOP Intermediate' },
    ],
    unread: 1,
  });
}

export async function getCourse(_session, courseId) {
  const course = COURSES.find(c => c.id === Number(courseId));
  if (course) {
    return assertCourseDetail({
      demo: true,
      course: stripInternal(course),
      sections: sectionsFor(course),
    });
  }

  /* Every chip on the English and Resources pages carries a real course id,
     so every one of them has to open something. A track we only know from
     the crawl gets its real title, category and cover art — and nothing
     else. No invented sections: the material is in Moodle, the page says
     so, and the button goes there. */
  const track = trackById(courseId);
  if (track) {
    return assertCourseDetail({
      demo: true,
      course: {
        id: track.id,
        code: track.category || '',
        /* A gated track has no public name; its navigation label is the
           only thing GLOW told us, so that is what we show. */
        title: track.title || track.nav,
        summary: track.summary || '',
        image: track.image || undefined,
        progress: 0,
        tracked: false,
        category: track.category || '',
        enrolled: false,
        moodlePath: `/course/view.php?id=${track.id}`,
        contentInMoodle: true,
      },
      sections: [],
    });
  }

  const e = new Error('No such course');
  e.statusCode = 404;
  throw e;
}

export async function getCatalog(_session, key) {
  if (key === 'english' || key === 'resources') {
    return { demo: true, groups: catalogGroups(key) };
  }
  const e = new Error('No such catalogue');
  e.statusCode = 404;
  throw e;
}

export async function getSsoUrl(_session, target) {
  /* Nothing to sign into in demo mode — send them to the real platform's
     own page and let it ask for a login, rather than inventing a session. */
  return `https://glow.mata9.com${target}`;
}

export async function fetchMedia() {
  const e = new Error('The demo serves its images as static files, not through the proxy');
  e.statusCode = 404;
  throw e;
}

/* Keep the catalogue's authoring fields (syllabus, the VI variants used to
   build sections) out of the API response — the contract does not include
   them and shipping extra fields invites the front end to depend on them. */
function stripInternal(c) {
  const { syllabus, summaryVi, titleEn, ...rest } = c;
  /* Derived rather than written on each row, so a course can never end up
     with an id and a path that disagree. */
  return { ...rest, summaryVi, titleEn, moodlePath: `/course/view.php?id=${c.id}` };
}

function soon(days) {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setHours(19, 0, 0, 0);
  return d.toISOString();
}

export const DEMO_CREDENTIALS = { username: DEMO_USER, password: DEMO_PASS };
