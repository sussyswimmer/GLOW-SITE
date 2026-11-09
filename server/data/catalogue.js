/* ═══════════════════════════════════════════════════════════
   The GLOW catalogue: categories, sub-categories, groups, courses.

   Hand-maintained from the client's content brief (FINAL column),
   2026-11-08 — .omc/plans/content-brief.txt. This is the one place
   that says which course exists, what it is called in English and
   Vietnamese, where it sits, and who may see it.

   SERVER-ONLY. src/ never imports this; the browser gets it through
   /api/catalogue, already filtered to what the viewer may see. The page
   builder (tools/build-pages.mjs) imports it at build time and writes
   only public courses into the static HTML.

   A course the viewer may not see does not exist for them: it is left
   out of every list and its page is a 404, not a 403.
   ═══════════════════════════════════════════════════════════ */

/* `page` is the static page that lists the category. `access` uses the
   same vocabulary as a course: '' (everyone) | 'gems' | 'seeds' | 'staff'. */
export const CATEGORIES = [
  { key: 'english', en: 'English Learning', vi: 'Học tiếng Anh', page: 'english.html', access: '',
    blurbEn: 'Testing, self-learning tracks, ETOP tutoring and English resources.',
    blurbVi: 'Kiểm tra trình độ, các lộ trình tự học, gia sư ETOP và tài nguyên tiếng Anh.' },
  { key: 'skills', en: 'Skills & Network Building', vi: 'Kỹ năng & Kết nối', page: 'skills.html', access: '',
    blurbEn: 'CoffeeTime talks, mentoring, career tracks and the Youth Empowerment Series.',
    blurbVi: 'Các buổi CoffeeTime, chương trình cố vấn, lộ trình nghề nghiệp và chuỗi khoá học Trao quyền cho Thanh niên.' },
  { key: 'training', en: 'Training', vi: 'Đào tạo nội bộ', page: 'training.html', access: 'staff',
    blurbEn: 'Pacific Links staff training.',
    blurbVi: 'Các khoá đào tạo dành cho nhân viên Pacific Links.' },
];

/* key doubles as the anchor id on the category page. */
export const SUBCATEGORIES = [
  { key: 'english-testing', cat: 'english', en: 'English Testing', vi: 'Kiểm tra tiếng Anh' },
  { key: 'english-self-learning', cat: 'english', en: 'English Self-Learning', vi: 'Tự học tiếng Anh' },
  { key: 'etop', cat: 'english', en: 'English Tutoring Online Program (ETOP)', vi: 'Chương trình gia sư tiếng Anh trực tuyến (ETOP)' },
  { key: 'english-resources', cat: 'english', en: 'English Resources', vi: 'Tài nguyên tiếng Anh' },

  { key: 'coffeetime', cat: 'skills', en: 'CoffeeTime', vi: 'CoffeeTime',
    descEn: 'Virtual discussions with professionals offering insights and practical guidance on work readiness, life skills and personal development.',
    descVi: 'Các buổi trò chuyện trực tuyến với chuyên gia, chia sẻ hiểu biết và hướng dẫn thực tế về sự sẵn sàng đi làm, kỹ năng sống và phát triển bản thân.' },
  { key: 'mentoring', cat: 'skills', en: 'Mentoring', vi: 'Cố vấn' },
  { key: 'career-track', cat: 'skills', en: 'In-depth Career Development Track', vi: 'Lộ trình phát triển nghề nghiệp chuyên sâu' },
  { key: 'youth-empowerment', cat: 'skills', en: 'Youth Empowerment Series', vi: 'Chuỗi khoá học Trao quyền cho Thanh niên',
    descEn: 'Self-paced courses for life and work.',
    descVi: 'Các khoá học tự học cho cuộc sống và công việc.' },
  { key: 'safe-migration', cat: 'skills', en: 'Safe Migration & Anti-Trafficking', vi: 'Di cư an toàn & Phòng chống mua bán người',
    descEn: 'Make informed choices about work and migration — interactive training on labor risks and exploitation red flags, support for responders and survivors, and digital tools to compare jobs, living costs and safe pathways.',
    descVi: 'Đưa ra lựa chọn sáng suốt về việc làm và di cư — khoá học tương tác về rủi ro lao động và dấu hiệu bóc lột, hỗ trợ người ứng phó và nạn nhân, cùng công cụ số để so sánh việc làm, chi phí sinh hoạt và lộ trình di cư an toàn.' },

  { key: 'staff-english', cat: 'training', en: 'English Learning', vi: 'Học tiếng Anh' },
  { key: 'migration-trafficking', cat: 'training', en: 'Migration & Trafficking Prevention', vi: 'Phòng ngừa rủi ro di cư & mua bán người' },
  { key: 'organization-skills', cat: 'training', en: 'Organization Skills', vi: 'Kỹ năng tổ chức' },
  { key: 'technical-skills', cat: 'training', en: 'Technical Skills', vi: 'Kỹ năng công nghệ' },
];

export const GROUPS = [
  { key: 'placement', sub: 'english-testing', en: 'Placement Test', vi: 'Kiểm tra xếp lớp' },
  { key: 'ielts', sub: 'english-testing', en: 'IELTS', vi: 'IELTS' },
  { key: 'toeic', sub: 'english-testing', en: 'TOEIC', vi: 'TOEIC' },
  { key: 'interview-prep', sub: 'english-testing', en: 'Interview Prep', vi: 'Luyện phỏng vấn' },

  { key: 'ted', sub: 'english-self-learning', en: 'TED Talks & Skills Building', vi: 'TED Talks & Phát triển kỹ năng' },
  { key: 'pronunciation', sub: 'english-self-learning', en: 'Pronunciation', vi: 'Phát âm' },
  { key: 'grammar-writing', sub: 'english-self-learning', en: 'Grammar & Writing', vi: 'Ngữ pháp & Viết' },
  { key: 'vocabulary', sub: 'english-self-learning', en: 'Vocabulary', vi: 'Từ vựng' },
  { key: 'comprehensive', sub: 'english-self-learning', en: 'Comprehensive Skills', vi: 'Kỹ năng tổng hợp' },

  { key: 's1', sub: 'coffeetime', en: 'S1 - Life Skills', vi: 'S1 - Kỹ năng sống' },
  { key: 's2', sub: 'coffeetime', en: 'S2 - Self-Awareness', vi: 'S2 - Hiểu bản thân' },
  { key: 's3', sub: 'coffeetime', en: 'S3 - New Knowledge & Career Exploration', vi: 'S3 - Kiến thức mới & Khám phá nghề nghiệp' },
  { key: 's4', sub: 'coffeetime', en: 'S4 - Networking & Opportunities', vi: 'S4 - Kết nối & Cơ hội' },

  { key: 'set', sub: 'career-track', en: 'Success with Entrepreneurship (SET)', vi: 'Thành công với Khởi nghiệp (SET)' },
  { key: 'grit', sub: 'career-track', en: 'Growing with Information Technology (GRIT)', vi: 'Chương trình tự học IT cùng nhau (GRIT)' },
];

/* [code, en, vi, sub, group, presenter, moodleId, confirm] — one row per
   course, in the brief's order. `cat` comes from the sub-category and
   `access` from the code (see accessOf), so neither is repeated per row. */
const ROWS = [
  ['EL0001', 'English Placement Assessment', '', 'english-testing', 'placement', '', 245],
  ['EL1001', 'IELTS Practice', '', 'english-testing', 'ielts', '', 61],
  ['EL1002', 'IELTS Speaking', '', 'english-testing', 'ielts', '', 1734],
  ['EL1003', 'IELTS Writing', '', 'english-testing', 'ielts', '', 2245],
  ['EL1101', 'TOEIC Practice', '', 'english-testing', 'toeic', '', 62],
  ['EL1201', "Donor's Interview Practice", '', 'english-testing', 'interview-prep', '', 1736],

  ['EL2011', 'TED Talks - General 1', '', 'english-self-learning', 'ted', '', 1105],
  ['EL2012', 'TED Talks - General 2', '', 'english-self-learning', 'ted', '', 1991],
  ['EL2021', 'TED Talks Career', '', 'english-self-learning', 'ted', '', 1749],
  ['EL2101', 'Pronunciation - Beginner', '', 'english-self-learning', 'pronunciation', '', 281],
  ['EL2103', 'Pronunciation - Advanced', '', 'english-self-learning', 'pronunciation', '', 278],
  ['EL2201', 'Grammar', '', 'english-self-learning', 'grammar-writing', '', 60],
  ['EL2301', 'Learn Vocabulary with Quizlet', '', 'english-self-learning', 'vocabulary', '', 1753],
  ['EL2401', 'English for Starters', '', 'english-self-learning', 'comprehensive', '', 2005],
  ['EL2402', 'Learn English through Books', '', 'english-self-learning', 'comprehensive', '', 1983],
  ['EL2404', 'Learn English through Movies', '', 'english-self-learning', 'comprehensive', '', 1750],

  ['EL3001', 'ETOP Beginner', '', 'etop', null, '', 241],
  ['EL3002', 'ETOP Intermediate', '', 'etop', null, '', 287],
  ['EL3003', 'ETOP Advanced', '', 'etop', null, '', 246],
  ['EL3011', 'Coaching for College', '', 'etop', null, '', 106],
  ['EL5001', 'IELTS Speaking Tutor Orientation', '', 'etop', null, '', null],

  ['EL5002', 'Tips for GLOW Self-Learning', '', 'english-resources', null, '', 1987],
  ['EL5003', 'How to use ChatBot AI', '', 'english-resources', null, '', 1986],
  ['EL5004', 'GEMS University Orientation', '', 'english-resources', null, '', null, 'Public, or GEMS scholars only?'],
  ['EL5006', 'SEEDS Handbook', '', 'english-resources', null, '', null, 'Public, or SEEDS scholars only?'],
  ['EL5005', 'GEMS Student Handbook', '', 'english-resources', null, '', null, 'Public, or GEMS scholars only?'],
  ['EL5007', 'Report Non-GLOW English Self-study Time', '', 'english-resources', null, '', 579],
  ['EL5008', 'Khan Academy', '', 'english-resources', null, '', 2213],

  ['EM1001', 'Book Club: How to Win Friends and Influence People', 'Cùng đọc Đắc Nhân tâm', 'coffeetime', 's1', 'Eric & Gil', null],
  ['EM1012', 'Effective Self-learning', 'Tự học hiệu quả', 'coffeetime', 's1', 'Spencer Benson', null],
  ['EM1017', 'Recognising and Avoiding Scams', 'Nhận diện và phòng tránh lừa đảo', 'coffeetime', 's1', 'Pacific Links Foundation', null],
  ['EM2001', 'Self-branding', 'Xây dựng thương hiệu cá nhân', 'coffeetime', 's2', 'Jocelyn Tran', null],
  ['EM2610', 'Practising Mindfulness', 'Thực hành Chánh niệm', 'coffeetime', 's2', 'Bach Xuan Phe', null, "Matches the Vietnamese 'Thực hành Chánh niệm'; confirm vs 'Self-Reliant and Independent mindset'"],
  ['EM2608', 'The Journey to Becoming an Engineer', 'Hành trình trở thành một kỹ sư', 'coffeetime', 's3', 'Nhu Bui & Song An Team', null, "The Vietnamese note says 'Định hướng nghề nghiệp'; confirm the title"],
  ['EM2611', 'Cybersecurity Career Orientation', 'Định hướng ngành An ninh mạng', 'coffeetime', 's3', 'Wendy Morales', null, 'Confirm vs the AI title'],
  ['EM4202', 'Building an effective resume', 'Xây dựng resume hiệu quả', 'coffeetime', 's4', 'Jocelyn Tran', null],
  ['EM2606', 'Preparing for Job Interviews', 'Chuẩn bị cho phỏng vấn xin việc', 'coffeetime', 's4', 'Jocelyn Tran', null, "Confirm vs 'Let's Talk About AI!'"],

  ['EM5001', 'SuccessPath Mentoring 2023', 'Chương Trình Cố Vấn SuccessPath 2023', 'mentoring', null, '', null],
  ['EM5002', 'SuccessPath Mentoring 2024', 'Chương Trình Cố Vấn SuccessPath 2024', 'mentoring', null, '', null],
  ['EM9001', 'SuccessPath Mentor Orientation', 'Hướng dẫn dành cho mentor', 'mentoring', null, '', null],

  ['EM6001', 'Success with Entrepreneurship (SET) 2023', 'SET 2023: Thành Công Với Khởi Nghiệp', 'career-track', 'set', '', null, 'SET vs PSET name'],
  ['EM6002', 'Success with Entrepreneurship (SET) 2024', 'SET 2024: Thành Công Với Khởi Nghiệp', 'career-track', 'set', '', null, 'SET vs PSET name'],
  ['EM6101', 'Growing with Information Technology (GRIT)', 'Chương trình tự học IT cùng nhau', 'career-track', 'grit', '', null, 'GRIT: Information vs Innovative Technology'],

  ['EM7101', 'Communication Skills', 'Kỹ năng giao tiếp', 'youth-empowerment', null, '', 2487],
  ['EM7103', 'Personal Financial Management', 'Quản lý tài chính cá nhân', 'youth-empowerment', null, '', 2440, 'Home shows EM7113; Skills page shows EM7103'],
  ['EM7106', 'Anti-Human Trafficking', 'Phòng, chống mua bán người', 'youth-empowerment', null, '', 2488],
  /* Not separate rows in the brief, but on the home carousel and in the prototype. */
  ['EM7110', 'Teamwork Skills', 'Kỹ năng làm việc nhóm', 'youth-empowerment', null, '', 2489],
  ['EM7108', 'Leadership Skills', 'Kỹ năng lãnh đạo', 'youth-empowerment', null, '', 2486],
  ['EM7112', 'AI: Basics to Application', 'AI từ cơ bản đến ứng dụng', 'youth-empowerment', null, '', 2441],

  ['FACT', 'FACT — Factory Awareness to Counter Trafficking', '', 'safe-migration', null, '', null, 'Full official title'],
  ['CARES', 'CARES — for frontline responders', '', 'safe-migration', null, '', null, 'Full official title'],
  ['RISE', 'RISE — for trafficking survivors', '', 'safe-migration', null, '', null, 'Full official title'],

  ['PT0001', 'English Placement Test for Staff', '', 'staff-english', null, '', null],
  ['PT1002', 'English Learning for Staff', '', 'staff-english', null, '', null],
  ['PT1003', 'Pronunciation for Staff', '', 'staff-english', null, '', null],
  ['PT2001', 'Human Trafficking, Forced Labor & Safe Migration', '', 'migration-trafficking', null, '', null],
  ['PT2002', 'Anti Fraud & CVAP', '', 'migration-trafficking', null, '', null],
  ['PT2003', 'Safe Migration', '', 'migration-trafficking', null, '', null],
  ['PT2004', 'Combating Human Trafficking', '', 'migration-trafficking', null, '', null],
  ['PT2005', 'Preventing Forced Labor', '', 'migration-trafficking', null, '', null],
  ['PT3001', 'Project Outcomes', '', 'organization-skills', null, '', null],
  ['PT3002', 'Social Media Training', '', 'organization-skills', null, '', null],
  ['PT3003', 'MOU Drafting', '', 'organization-skills', null, '', null],
  ['PT3004', 'Practical Project Management', '', 'organization-skills', null, '', null],
  ['PT3005', 'Public Narrative', '', 'organization-skills', null, 'Sandy Dang', null],
  ['PT3006', 'Grant Writing Training', '', 'organization-skills', null, 'Adam & Diane Truong', null],
  ['PT3007', 'Staff Policy Training', '', 'organization-skills', null, '', null],
  ['PT4001', 'LimeSurvey', '', 'technical-skills', null, '', null],
  ['PT4002', 'Moodle Introduction', '', 'technical-skills', null, '', null],
  ['PT4003', 'LMS Internal Training', '', 'technical-skills', null, '', null],
  ['PT4004', 'How To Use GLOW', '', 'technical-skills', null, '', null],
];

const ACCESS = { EL5004: 'gems', EL5005: 'gems', EL5006: 'seeds' };
const accessOf = code => ACCESS[code] || (code.startsWith('PT') ? 'staff' : '');
const catOf = sub => SUBCATEGORIES.find(s => s.key === sub).cat;

export const COURSES = ROWS.map(([code, en, vi, sub, group, presenter, moodleId, confirm = '']) => ({
  code, en, vi, cat: catOf(sub), sub, group, presenter,
  access: accessOf(code), moodleId, confirm,
}));

/* ── access ──────────────────────────────────────────────────
   `role` is null when signed out. Staff see everything. */
export function canSee(course, role) {
  const a = course.access;
  return !a || role === 'staff' || a === role;
}

export function visibleCourses(role) {
  return COURSES.filter(c => canSee(c, role));
}

export function courseByCode(code) {
  const k = String(code || '').toUpperCase();
  return COURSES.find(c => c.code === k) || null;
}

export function courseByMoodleId(id) {
  const n = Number(id);
  return COURSES.find(c => c.moodleId === n) || null;
}

/* The catalogue as one viewer may see it. A category, sub-category or
   group with no visible course is dropped, so a signed-out visitor is
   never told that Training exists. */
export function catalogueFor(role) {
  const courses = visibleCourses(role);
  const subs = new Set(courses.map(c => c.sub));
  const cats = new Set(courses.map(c => c.cat));
  const groups = new Set(courses.map(c => c.group).filter(Boolean));
  return {
    categories: CATEGORIES.filter(c => cats.has(c.key)),
    subcategories: SUBCATEGORIES.filter(s => subs.has(s.key)),
    groups: GROUPS.filter(g => groups.has(g.key)),
    courses,
  };
}

/* ── self-checks ─────────────────────────────────────────────
   Run at import: a typo in this file fails the server at boot, not on a
   learner's page. */
(function selfCheck() {
  const fail = m => { throw new Error(`catalogue: ${m}`); };
  const codes = new Set();
  for (const c of COURSES) {
    if (codes.has(c.code)) fail(`duplicate code ${c.code}`);
    codes.add(c.code);
    if (!SUBCATEGORIES.some(s => s.key === c.sub)) fail(`${c.code}: unknown sub ${c.sub}`);
    if (c.group && GROUPS.find(g => g.key === c.group)?.sub !== c.sub) fail(`${c.code}: group ${c.group} is not in ${c.sub}`);
  }
  const ids = COURSES.map(c => c.moodleId).filter(Boolean);
  if (new Set(ids).size !== ids.length) fail('duplicate moodleId');
  for (const s of SUBCATEGORIES) if (!CATEGORIES.some(c => c.key === s.cat)) fail(`sub ${s.key}: unknown cat`);
  for (const g of GROUPS) if (!SUBCATEGORIES.some(s => s.key === g.sub)) fail(`group ${g.key}: unknown sub`);

  const at = (code, role) => canSee(courseByCode(code), role);
  const ok = (cond, m) => { if (!cond) fail(`canSee: ${m}`); };
  ok(at('EL1001', null) && at('EL1001', 'learner'), 'public course');
  ok(!at('EL5004', null) && !at('EL5004', 'learner') && !at('EL5004', 'seeds'), 'gems hidden from others');
  ok(at('EL5004', 'gems') && at('EL5004', 'staff'), 'gems visible to gems and staff');
  ok(!at('EL5006', 'gems') && at('EL5006', 'seeds') && at('EL5006', 'staff'), 'seeds');
  ok(!at('PT0001', null) && !at('PT0001', 'gems') && at('PT0001', 'staff'), 'staff only');
})();
