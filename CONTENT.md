# GLOW — content inventory

Everything on the rebuild, and where it came from. Source of truth is the live
platform at `glow.mata9.com` (Moodle 4.x, theme `lambda2`).

**Nothing here is invented.** Copy is either lifted verbatim from GLOW, or
written from GLOW's own material. Where a number appears it is a count I could
derive from their site, not an estimate. See "Deliberately not written" below.

---

## Identity

| | |
|---|---|
| Name | **GLOW** — *Growing Learning Opportunities Worldwide* (an acronym; taken from the wordmark) |
| Operator | **Pacific Links Foundation** |
| Footer line | `© 2026 Pacific Links Foundation` (verbatim) |
| Login | `https://glow.mata9.com/login/index.php` |
| Languages | English + Vietnamese (`?lang=vi` exists on their pages) |

### Palette — Matera Alliance Brand Guideline §4.1

The site is dressed in the Matera Alliance identity. The eight RGB hex values
below are reproduced verbatim from the guideline (the RGB column, which is the
one for digital use); everything else is a tint, a shade, or a contrast-safe
step derived from them.

| Token | Hex | Guideline role |
|---|---|---|
| `--deep` | `#014E45` | Logo Dark Color, Typography Color |
| `--leaf` | `#1B8F45` | Logo Color |
| `--sage` | `#6FC7B6` | Logo Color |
| `--spring` | `#1ECE94` | Pattern Color — the site's accent |
| `--spring-d` | `#14BA76` | Pattern Color |
| `--teal` | `#40D3BA` | Pattern Color |
| `--mint` | `#B7EAE7` | Pattern Color |
| `--paper-2` | `#F9F9F9` | Background Color |

Derived, with the reason each one exists:

| Token | Hex | Why |
|---|---|---|
| `--deep-d` / `--deep-x` | `#013B36` / `#00241F` | the hero field; white on them is 12.5:1 / 16.5:1 |
| `--moss` | `#0F6B4A` | `#1B8F45` is 4.15:1 on white and kickers are small caps; this is 6.5:1 |
| `--spring-t` | `#085838` | the accent as text — passes 4.5:1 even mid-fade at 80% opacity |
| `--spring-x` | `#0FA265` | the focus ring — 3.3:1 on white, 3.8:1 on the deep field |
| `--ink` / `--muted` / `--faint` | `#1B2A26` / `#3F5A54` / `#587068` | 14.9:1 / 7.5:1 / 5.3:1 |
| `--matte` | `#DDF1F7` | **not** a brand colour: sampled from GLOW's own slide artwork so the letterboxing behind those images stays invisible |

Type: **Anybody Bold** (§5.1, headlines) + **Roboto** (§5.2–5.3, sub-headlines
and bodytext). Both carry the full Vietnamese diacritic set.

Pattern (§6): the "Spreading" stripe bands and concentric circle ripples, both
built on the golden ratio — shares of 44.72 / 27.64 / 17.08 / 10.56%. They are
`.bands` and `.ripple` in `src/styles.css`, each a single gradient on a single
element. Circles appear only at the top and bottom of a layout (§7.4).

GLOW's own wordmark, logo files, course artwork and every word of copy are
unchanged.

---

## The three pillars

Verbatim from GLOW's own hero slides ("What's on GLOW"):

1. **English Learning** — "Master English conveniently, anytime, anywhere!"
2. **Professional Development** — "Access resources, enhance knowledge for future career path!"
3. **Skills & Network Building** — "Build skills, expand networks, and embrace success!"

These drive the three story chapters.

## Course catalogue — Upskilling Development

All six, with their real course codes, titles and syllabus points:

| Code | Title (VI) | English | Syllabus, from their course summary |
|---|---|---|---|
| EMM231 | Kỹ Năng Làm Việc Nhóm | Teamwork Skills | Giới thiệu chung về làm việc nhóm · Mô hình nhóm và quy trình tổ chức buổi sinh hoạt · Nguyên tắc tổ chức và làm việc nhóm hiệu quả |
| EMM230 | Kỹ Năng Giao Tiếp | Communication Skills | Định nghĩa và nội dung giao tiếp hiệu quả · Hình thức và phương tiện giao tiếp · Phong cách giao tiếp |
| EMM232 | Kỹ Năng Lãnh Đạo | Leadership Skills | Định nghĩa về lãnh đạo · Các kiểu lãnh đạo và phẩm chất · Các kỹ năng của người lãnh đạo |
| EMM227 | Phòng, Chống Mua Bán Người | Anti-Human Trafficking | Định nghĩa mua bán người · Nhận biết kẻ buôn người và nạn nhân, hình thức bóc lột và thủ đoạn · Bảo vệ bản thân và những người xung quanh |
| EM7112 | AI Từ Cơ Bản Đến Ứng Dụng | AI: Basics to Application | Youth Empowerment Series |
| EM7113 | Quản Lý Tài Chính | Financial Management | Youth Empowerment Series |

## English self-learning tracks

From their navigation, verbatim:

- **TED Talks** — General 1, General 2, General 3, Careers, Ted Talks Career Deck, Ted Talks AI
- **Pronunciation** — Beginner, Intermediate, Advanced, Practice for Donor's interview
- **ETOP** — Beginner, Intermediate, Advanced, Coaching
- **Testing** — TOEIC, IELTS, IELTS Speaking, IELTS Writing, Placement Assessment
- **Other** — Quizlet, Movies, Idioms/collocation, Sentence Diagramming, Grammar, Songs, Books, English for beginners

## Educational Resources

- Chatbots AI
- Tips for GLOW self learning
- Report self-study time
- Khan Academy

---

## Images — all pulled from GLOW

| File | Source |
|---|---|
| `glow-logo.png` | site logo (`core_admin/logo`) |
| `slide2.png` … `slide4.png` | three of the five `theme_lambda2` hero slideshow images. `slide1.gif` (2.1 MB) and `slide5.png` are never rendered by any page — they were shipped in every build for nothing, and are now in `.gen/retired/`. `npm run catalogue` re-crawls them if they are ever wanted back. |
| `course-teamwork.png` | EMM231 course cover |
| `course-communication.png` | EMM230 course cover |
| `course-leadership.png` | EMM232 course cover |
| `course-antitrafficking.png` | EMM227 course cover |
| `course-ai.png` | EM7112 course cover |
| `course-finance.png` | EM7113 course cover |

Plus `assets/img/courses/` — **12 more real course covers**, one per track a
guest is allowed to see, downloaded by `tools/pull-course-art.mjs` and named
after the course. Before this, seventeen different tracks were wearing the
same three hero slides as stand-in artwork.

Their slides are wide banners (~4:1), so every frame that shows one uses
`object-fit: contain`. `cover` crops the headline off both ends.

### Which slide goes where — and the one that is missing

The three slides are not interchangeable and were being used as if they were.
What each one actually is:

| File | What is on it |
|---|---|
| `slide2.png` | **"What's on GLOW"** — the overview diagram, all three pillars in one ring |
| `slide3.png` | **English Learning** — "Master English conveniently, anytime, anywhere!" |
| `slide4.png` | **Professional Development** — "Access resources, enhance knowledge for future career path!" |

So `slide2` belongs to the showcase panel (`#inside`), whose heading is
"What's on GLOW", and `slide3`/`slide4` belong to pillars 01 and 02 of the
pinned frame. The homepage previously ran `slide2` in **both** places, which
pushed every pillar's picture one behind its heading — English Learning was
captioned "Professional Development", and so on down the three.

**There is no slide for pillar 03, Skills & Network Building.** GLOW's
`theme_lambda2` slideshow does not have one. Pillar 03 currently borrows
`course-teamwork.png`, the cover of the course that pillar leads with — it is
on-brand and it is honest, but it is a course cover in a row of deck slides
and it looks like one. **Worth asking Pacific Links for a third slide in the
same set**; when it arrives it drops straight into `data-shot="2"` in
`index.html` with nothing else to change.

---

## Deliberately not written

Two things a rebuild for a real foundation must not fabricate, so they aren't:

- **Testimonials.** The three cards in the stats band are *factual summaries* of
  what is on the platform (testing, learning-through-content, resources) with
  category labels — not quotes attributed to invented learners.
- **Impact statistics.** The three numerals are counts derived from their own
  site: 5 English tracks, 6 skills courses, 2 languages. No learner counts,
  completion rates or outcome figures — I have no source for those.

If Pacific Links has real testimonials and impact numbers, both are drop-in
replacements: the quote cards and `data-to` attributes in `index.html`.

---

---

## The catalogue crawl

`server/data/glow-catalogue.js` is **generated**, not written:

```
node tools/crawl-public.mjs      # read glow.mata9.com as an anonymous visitor
node tools/pull-course-art.mjs   # download the course covers it found
node tools/build-catalogue.mjs   # emit server/data/glow-catalogue.js
```

That is the whole update path when Pacific Links changes the platform.

**What it gets.** All **31** tracks in their navigation, with GLOW's real
course ids. Moodle shows an anonymous visitor the enrolment page for a course
that is merely un-enrollable, and that page carries the real full name,
category and summary — so **12** of the 31 arrive complete, with their own
cover art. The remaining **19** answer *"This course is currently unavailable
to students"*, and carry only the navigation label.

The ids are the point. A track chip now links to a course page that can
deep-link into the actual platform, instead of being a label with nothing
behind it — and `moodlePath` + `/api/sso` land the learner there signed in.

### Two things found on their live site, worth passing to Pacific Links

| | |
|---|---|
| **Broken menu link** | Their own nav points *Placement Assessment* at `course/view.php?id=245%5C` — a stray backslash. The course (id 245, "English Placement Assessment") is fine; the menu item is not. |
| **Duplicated courses** | The four skills courses listed publicly are titled *"… copy"* (ids 2486–2489), i.e. duplicates of the originals. This rebuild uses the publicly listed ids and displays the titles without the word. Worth confirming which copy is canonical before go-live. |

## Still behind the login

Everything above came from an anonymous session. These still need an
authenticated one:

- course **interiors** for all 31 tracks — lessons, pages, activity structure
- videos and any media inside courses
- quizzes, assignments, the placement assessment
- full titles and summaries for the **19 gated tracks**

None of it is invented in the meantime. A gated track shows its navigation
label, no summary, no artwork, and a course page that says the material is on
the GLOW platform with a button that goes there — rather than an empty course,
which would read as "your course has nothing in it".

To pull the rest, in order of preference:

1. **A web-services token** (`docs/MOODLE-SETUP.md`) — this is the real answer.
   With `DATA_SOURCE=moodle` the interiors arrive through the API and nothing
   needs crawling at all.
2. **The Chrome extension connected**, so a signed-in browser can be driven.
3. A Moodle course backup or admin export.

Session cookies pasted into a terminal would also work and are the least safe
of the four.
