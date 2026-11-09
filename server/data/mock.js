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
   • Not real, and marked as such: the four demo accounts, all progress
     percentages, the calendar events, and the activity rows inside a
     course. Course interiors sit behind the login and were never
     accessible, so they are illustrative structure, not their content.

   Every API response made from this adapter carries `demo: true` (stamped
   by routes/api.js from isDemo), and the UI shows a standing banner because of it. That flag is the only thing
   standing between a demo and a foundation believing it is looking at
   its own learners, so it is not optional and not silenceable.
   ═══════════════════════════════════════════════════════════ */

import { assertDashboard, assertCourseDetail, assertBilling } from './contract.js';
import { billingFor } from './billing.js';
import { catalogGroups, trackById } from './glow-catalogue.js';
import { CATEGORIES, courseByCode, courseByMoodleId } from './catalogue.js';

/* The accounts that can sign in against the mock, one per role. Documented
   in docs/DEPLOY.md; with DATA_SOURCE=moodle this adapter is never loaded.
   The repo is public, so these passwords are not secrets — real staff
   gating comes from Moodle. Initials are first + last, matching the rule in
   moodle.js: Vietnamese names are family-name-first. */
const ACCOUNTS = {
  demo:         { pass: 'glow-demo-2026',  id: 1, fullname: 'Lê Thị A',     initials: 'LA', idnumber: 'QT20P0007', role: 'learner' },
  'demo-gems':  { pass: 'glow-demo-2026',  id: 2, fullname: 'Nguyễn Văn B', initials: 'NB', idnumber: 'HU21G0012', role: 'gems' },
  'demo-seeds': { pass: 'glow-demo-2026',  id: 3, fullname: 'Trần Thị C',   initials: 'TC', idnumber: 'QT24S0031', role: 'seeds' },
  'demo-staff': { pass: 'glow-staff-2026', id: 4, fullname: 'Phạm Minh D',  initials: 'PD', idnumber: undefined,   role: 'staff' },
};

function learnerOf(username) {
  const { pass, ...learner } = ACCOUNTS[username];
  return { ...learner, username };
}

/* The token is `mock:<username>`, so getLearner and getDashboard know whose
   data to serve. Anything else (an old cookie) is a signed-out request. */
function usernameOf(session) {
  const u = String(session?.token || '').replace(/^mock:/, '');
  if (!Object.hasOwn(ACCOUNTS, u)) {
    const e = new Error('invalid_token');
    e.statusCode = 401;
    throw e;
  }
  return u;
}

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

/* ── the adapter surface — same as moodle.js ─────────────── */

export async function login(username, password) {
  const acct = Object.hasOwn(ACCOUNTS, username) ? ACCOUNTS[username] : null;
  if (!acct || acct.pass !== password) {
    const e = new Error('invalid_credentials');
    e.statusCode = 401;
    throw e;
  }
  return { token: `mock:${username}` };
}

export async function getLearner(session) {
  return learnerOf(usernameOf(session));
}

/* ── per-account dashboards ──────────────────────────────────
   From the prototype's ROLES (.omc/plans/prototype-data.js). `recent` rows
   are [code, progress %, hours studied, lessons done, lessons total]. Event
   dates are relative to now so "Coming Up" never goes empty: [days from today,
   "HH:MM" Vietnam time, English, Vietnamese, course code]. */
const DASH = {
  learner: {
    mine: ['EL3001', 'EL2101', 'EL2011', 'EM7101', 'EM1012'],
    recent: [['EL3001', 60, 12, 6, 10], ['EM7101', 45, 5, 4, 9], ['EL2101', 30, 3, 3, 10]],
    rec: ['EM1012', 'EL2301', 'EM7108'],
    pin: null,
    events: [
      [1, '14:00', 'Meeting with your tutor', 'Buổi gặp gia sư của bạn', 'EL3001'],
      [3, '15:00', 'English Day', 'Ngày hội tiếng Anh'],
      [6, '14:00', 'ETOP Intermediate session', 'Buổi học ETOP Trung cấp', 'EL3002'],
    ],
    emmai: {
      vi: 'Chưa biết nên học gì tiếp theo? EMMAI gợi ý khoá học phù hợp với mục tiêu của bạn và đồng hành cùng hành trình tự học.',
      en: 'Not sure what to learn next? EMMAI recommends courses for your goals and guides your self-learning journey.',
    },
  },
  gems: {
    mine: ['EL1001', 'EM5002', 'EM7112', 'EL5004', 'EL5005'],
    recent: [['EL1001', 40, 9, 4, 10], ['EM5002', 70, 14, 7, 10], ['EM7112', 25, 2, 2, 8]],
    rec: ['EL1002', 'EM4202', 'EM2606'],
    pin: { vi: 'Dành cho học bổng GEMS', en: 'For GEMS scholars', courses: ['EL5004', 'EL5005'] },
    events: [
      [3, '15:00', 'English Day', 'Ngày hội tiếng Anh'],
      [6, '19:30', 'SuccessPath mentor meeting', 'Buổi gặp cố vấn SuccessPath', 'EM5002'],
      [12, '09:00', 'IELTS practice test', 'Bài thi thử IELTS', 'EL1001'],
    ],
    emmai: {
      vi: 'Đang chuẩn bị vào đại học? EMMAI giúp bạn chọn các khoá học phù hợp với ngành học và định hướng nghề nghiệp.',
      en: 'Planning for university? EMMAI can help you choose courses that prepare you for your major and your career.',
    },
  },
  seeds: {
    mine: ['EL2401', 'EM1012', 'EM7110', 'EL5006'],
    recent: [['EL2401', 55, 6, 5, 9], ['EM1012', 80, 3, 4, 5], ['EM7110', 20, 1, 1, 6]],
    rec: ['EL2101', 'EM1001', 'EM2001'],
    pin: { vi: 'Dành cho học bổng SEEDS', en: 'For SEEDS scholars', courses: ['EL5006'] },
    events: [
      [3, '15:00', 'English Day', 'Ngày hội tiếng Anh'],
      [9, '19:00', 'Study group', 'Nhóm học tập', 'EL2401'],
    ],
    emmai: {
      vi: 'Muốn xây dựng thói quen học tập tốt? EMMAI gợi ý những khoá học ngắn giúp bạn tự học hiệu quả.',
      en: 'Want to build good study habits? EMMAI suggests short courses to help you learn on your own.',
    },
  },
  staff: {
    mine: ['PT4004', 'PT2003', 'PT3006', 'PT1002'],
    recent: [['PT4004', 100, 2, 5, 5], ['PT2003', 50, 3, 3, 6], ['PT3006', 30, 2, 2, 7]],
    rec: ['PT2004', 'PT3004', 'PT4002'],
    pin: { vi: 'Đào tạo nội bộ', en: 'Staff training', courses: ['PT3007', 'PT2001'] },
    events: [
      [3, '09:00', 'Tech Against Trafficking conference', 'Hội nghị Công nghệ chống mua bán người'],
      [10, '15:00', 'Staff Policy Training', 'Tập huấn chính sách nhân viên', 'PT3007'],
    ],
    emmai: {
      vi: 'Cần ôn lại kiến thức? EMMAI có thể chỉ cho bạn khoá đào tạo nội bộ phù hợp.',
      en: 'Need a refresher? EMMAI can point you to the right staff training.',
    },
  },
};

const CATEGORY_EN = Object.fromEntries(CATEGORIES.map(c => [c.key, c.en]));

/* A Course built from the catalogue entry. */
function courseOf(code, extra = {}) {
  const k = courseByCode(code);
  return {
    ...(k.moodleId ? { id: k.moodleId, moodlePath: `/course/view.php?id=${k.moodleId}` } : {}),
    code: k.code,
    title: k.en,
    ...(k.vi ? { titleVi: k.vi } : {}),
    summary: '',
    progress: 0,
    tracked: true,
    category: CATEGORY_EN[k.cat],
    categoryKey: k.cat,
    enrolled: false,
    href: `./course.html?code=${k.code}`,
    ...extra,
  };
}

/* "Vietnam time, N days from today" as an ISO instant. */
function inDays(days, hhmm) {
  const day = new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
  return new Date(`${day}T${hhmm}:00+07:00`).toISOString();
}

export async function getDashboard(session) {
  const role = learnerOf(usernameOf(session)).role;
  const d = DASH[role];

  const recent = d.recent.map(([code, progress, hours, lessonsDone, lessonsTotal], i) =>
    courseOf(code, { progress, hours, lessonsDone, lessonsTotal, enrolled: true, lastAccess: daysAgo(i + 1) }));
  const byCode = new Map(recent.map(c => [c.code, c]));

  const courses = d.mine.map(code => byCode.get(code) ||
    /* Enrolled but not recently opened: a modest, deterministic progress. */
    courseOf(code, { enrolled: true, progress: 10 + [...code].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 26 }));

  /* Recommended and pinned reuse the My courses object when enrolled, so the
     same course never shows two different progress values; otherwise it is
     an untracked card with no bar. */
  const mine = new Map(courses.map(c => [c.code, c]));
  const card = code => mine.get(code) || courseOf(code, { tracked: false });

  return assertDashboard({
    learner: learnerOf(usernameOf(session)),
    courses,
    recent,
    recommended: d.rec.map(card),
    pinned: d.pin && { titleVi: d.pin.vi, titleEn: d.pin.en, courses: d.pin.courses.map(card) },
    events: d.events.map(([days, time, title, titleVi, code], i) => ({
      id: i + 1,
      title,
      titleVi,
      when: inDays(days, time),
      ...(code ? { courseTitle: courseByCode(code).en } : {}),
    })),
    emmai: d.emmai,
    unread: 1,
  });
}

/* The same answer the live adapter gives while billing.js has no amount:
   nobody can owe a fee that has not been set, so the demo must not say
   "not paid yet" beside "there is nothing to pay right now". Switch this to
   'unpaid' to review that state once a price exists. */
export async function getBilling() {
  return assertBilling(billingFor('unknown'));
}

export async function getCourse(session, courseId) {
  const course = COURSES.find(c => c.id === Number(courseId));
  if (course) {
    /* Progress and enrolment are this account's, so the course page agrees
       with the dashboard. The interior is illustrative for everyone. */
    const mine = (await getDashboard(session)).courses.find(c => c.id === course.id);
    return assertCourseDetail({
      course: { ...stripInternal(course), progress: mine?.progress ?? 0, enrolled: Boolean(mine) },
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
    return { groups: catalogGroups(key) };
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

/* Keep the syllabus (used only to build sections) out of the API response.
   moodlePath is derived rather than written on each row, so a course can
   never end up with an id and a path that disagree. The catalogue gives
   the code, names and page, so a course here matches what the dashboard says. */
function stripInternal(c) {
  const { syllabus, titleEn, ...rest } = c;
  const k = courseByMoodleId(c.id);
  return {
    ...rest,
    ...(k ? { code: k.code, title: k.en, ...(k.vi ? { titleVi: k.vi } : {}), categoryKey: k.cat, category: CATEGORY_EN[k.cat] } : {}),
    moodlePath: `/course/view.php?id=${c.id}`,
    href: k ? `./course.html?code=${k.code}` : `./course.html?id=${c.id}`,
  };
}
