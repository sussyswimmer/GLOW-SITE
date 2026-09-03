/* ═══════════════════════════════════════════════════════════
   GENERATED — do not hand-edit.
     node tools/crawl-public.mjs && node tools/build-catalogue.mjs

   GLOW's real catalogue, harvested from glow.mata9.com without a login.
   Every id, title, category, summary and cover image below came off their
   platform; nothing here is written.

   `gated: true` means Moodle answered "This course is currently
   unavailable to students" for an anonymous visitor, so only the
   navigation label is known. Those tracks deliberately carry no title,
   summary or artwork rather than a plausible-looking guess — see
   CONTENT.md, "Still behind the login".

   Crawled: https://glow.mata9.com
   Tracks: 31 · readable 12 · gated 19 · with cover art 12
   ═══════════════════════════════════════════════════════════ */

export const GROUPS = [
  {
    "key": "ted",
    "title": "TED Talks",
    "titleVi": "TED Talks",
    "catalog": "english"
  },
  {
    "key": "pronunciation",
    "title": "Pronunciation",
    "titleVi": "Phát âm",
    "catalog": "english"
  },
  {
    "key": "etop",
    "title": "ETOP",
    "titleVi": "ETOP",
    "catalog": "english"
  },
  {
    "key": "testing",
    "title": "Testing",
    "titleVi": "Kiểm tra",
    "catalog": "english"
  },
  {
    "key": "other",
    "title": "Other",
    "titleVi": "Khác",
    "catalog": "english"
  },
  {
    "key": "resources",
    "title": "Educational Resources",
    "titleVi": "Tài nguyên giáo dục",
    "catalog": "resources"
  }
];

export const TRACKS = [
  { "id":1105,"group":"ted", "nav":"General 1", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1105" },
  { "id":1991,"group":"ted", "nav":"General 2", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1991" },
  { "id":1992,"group":"ted", "nav":"General 3", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1992" },
  { "id":1749,"group":"ted", "nav":"Careers", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1749" },
  { "id":2205,"group":"ted", "nav":"Ted Talks Career Deck", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=2205" },
  { "id":2219,"group":"ted", "nav":"Ted Talks AI", "title":"TED Talks AI", "category":"English Self-learning", "summary":null,"image":"/assets/img/courses/ted-talks-ai.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=2219" },
  { "id":281,"group":"pronunciation", "nav":"Beginner", "title":"Pronunciation - Beginner", "category":"English Self-learning", "summary":null,"image":"/assets/img/courses/pronunciation-beginner.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=281" },
  { "id":279,"group":"pronunciation", "nav":"Intermediate", "title":"Pronunciation - Intermediate", "category":"English Self-learning", "summary":null,"image":"/assets/img/courses/pronunciation-intermediate.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=279" },
  { "id":278,"group":"pronunciation", "nav":"Advanced", "title":"Pronunciation - Advanced", "category":"English Self-learning", "summary":null,"image":"/assets/img/courses/pronunciation-advanced.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=278" },
  { "id":1736,"group":"pronunciation", "nav":"Practice for Donor's interview", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1736" },
  { "id":241,"group":"etop", "nav":"Beginner", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=241" },
  { "id":287,"group":"etop", "nav":"Intermediate", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=287" },
  { "id":246,"group":"etop", "nav":"Advanced", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=246" },
  { "id":106,"group":"etop", "nav":"Coaching", "title":"ETOP Coaching for College", "category":"ETOP", "summary":null,"image":"/assets/img/courses/etop-coaching-for-college.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=106" },
  { "id":62,"group":"testing", "nav":"TOEIC", "title":"TOEIC Practice", "category":"English Testing", "summary":"Tự Học Luyện Thi TOEIC là lớp tập hợp nhiều tài nguyên miễn phí trên mạng để giúp học sinh chuẩn bị thi TOEIC. Những tài nguyên ở đây kể cả nhiều webinar về những phương pháp học cho bài thi, nhiều kênh YouTube, cả tiếng Việt và tiếng Anh, với nhiều đề mục về cách thi TOEIC, và những bài thi tập.", "image":"/assets/img/courses/toeic-practice.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=62" },
  { "id":61,"group":"testing", "nav":"IELTS", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=61" },
  { "id":1734,"group":"testing", "nav":"IELTS Speaking", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1734" },
  { "id":2245,"group":"testing", "nav":"IELTS Writing", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=2245" },
  { "id":245,"group":"testing", "nav":"Placement Assessment", "title":"English Placement Assessment", "category":"English Testing", "summary":null,"image":"/assets/img/courses/english-placement-assessment.png", "gated":false,"brokenOnGlow":true,"url":"https://glow.mata9.com/course/view.php?id=245" },
  { "id":1753,"group":"other", "nav":"Quizlet", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1753" },
  { "id":1750,"group":"other", "nav":"Movies", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1750" },
  { "id":1135,"group":"other", "nav":"Idioms/ collocation", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1135" },
  { "id":1128,"group":"other", "nav":"Sentence Diagramming", "title":"Sentence Diagramming", "category":"English Self-learning", "summary":null,"image":"/assets/img/courses/sentence-diagramming.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=1128" },
  { "id":60,"group":"other", "nav":"Grammar", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=60" },
  { "id":1999,"group":"other", "nav":"Songs", "title":"Learn English though Songs", "category":"English Self-learning", "summary":"Học Anh Văn Qua Các Bài Hát - Những bài hát là một nguồn tài nguyên tuyệt vời để học Anh Ngữ thực dụng hàng ngày. Học tiếng Anh qua những bài hát là một cách học hứng thú và rất hiệu quả. Trong lớp này, các em sẽ học nhiều từ vựng và tập nghe cách phát âm qua những bài hát Popular Music và các bài hát trong các phim hoạt họa Disney.", "image":"/assets/img/courses/learn-english-though-songs.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=1999" },
  { "id":1983,"group":"other", "nav":"Books", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1983" },
  { "id":2005,"group":"other", "nav":"English for beginners", "title":"English for Starters", "category":"English Self-learning", "summary":"This course is for the pre-intermediate level learners. The course will help students improve 4 skills: reading, listening, writing and speaking.", "image":"/assets/img/courses/english-for-starters.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=2005" },
  { "id":1986,"group":"resources", "nav":"Chatbots AI", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=1986" },
  { "id":1987,"group":"resources", "nav":"Tips for GLOW self learning", "title":"Tips for GLOW self learning", "category":"Educational Resources", "summary":null,"image":"/assets/img/courses/tips-for-glow-self-learning.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=1987" },
  { "id":579,"group":"resources", "nav":"Report self-study time", "title":null,"category":null,"summary":null,"image":null,"gated":true,"url":"https://glow.mata9.com/course/view.php?id=579" },
  { "id":2213,"group":"resources", "nav":"Khan Academy", "title":"Khan academy", "category":"Educational Resources", "summary":null,"image":"/assets/img/courses/khan-academy.png", "gated":false,"url":"https://glow.mata9.com/course/view.php?id=2213" },
];

const byId = new Map(TRACKS.map(t => [t.id, t]));

/** A track by its real Moodle course id, or undefined. */
export function trackById(id) {
  return byId.get(Number(id));
}

/**
 * The catalogue shape the API contract expects: groups of
 * `{ title, courseId }`. Chips carry a courseId only when there is a
 * course page worth opening — the front end renders the rest as plainly
 * unavailable instead of as a link to nowhere.
 */
export function catalogGroups(catalog) {
  return GROUPS.filter(g => g.catalog === catalog).map(g => ({
    title: g.title,
    titleVi: g.titleVi,
    items: TRACKS.filter(t => t.group === g.key).map(t => ({
      title: t.nav,
      courseId: t.id,
    })),
  }));
}
