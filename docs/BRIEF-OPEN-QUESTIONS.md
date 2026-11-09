# Content brief: open questions for the team

The site was rebuilt from the GLOW website content brief (Google Sheet, FINAL column). Where the brief marks a row CONFIRM, or leaves something undecided, the site currently uses the brief's FINAL text, or the decision noted below. Each item says where it lives, so a change is a quick edit.

## Names and titles (brief CONFIRM rows)

1. **Vietnamese copy.** Every new Vietnamese string was written by the developers and needs a native-speaker review: menus, headings, buttons, Vietnamese course-category names and EMMAI messages.
2. **"Growing" or "Global"** Learning Opportunities Worldwide? The site uses "Growing" (rows 4, 18).
3. **SET or PSET**: Success with Entrepreneurship, or Passport to Success through Entrepreneurship? The site uses SET (rows 35, 169–171).
4. **GRIT**: Growing with *Information* Technology or *Innovative* Technology? The site uses Information (rows 172–173).
5. **EM7113 or EM7103** for Financial Management. The home carousel shows "Financial Management (EM7113)" per the brief, but the card opens EM7103 "Personal Financial Management", the course on the Skills page (rows 55, 176).
6. **EM2610**: Practising Mindfulness, or Self-Reliant and Independent mindset? (row 157)
7. **EM2608**: "The Journey to Becoming an Engineer". Is the Vietnamese title "Hành trình trở thành một kỹ sư" or "Định hướng nghề nghiệp"? (row 159)
8. **EM2611**: Cybersecurity Career Orientation, or the AI title? (row 160)
9. **EM2606**: Preparing for Job Interviews, or "Let's Talk About AI!"? (row 163)
10. **FACT, CARES, RISE.** What are their official full titles and course codes? The site shows "FACT — Factory Awareness to Counter Trafficking", "CARES — for frontline responders" and "RISE — for trafficking survivors".
11. **Vietnamese names for English-learning (EL) and staff training (PT) courses.** The brief only gives Vietnamese names for EM courses, so EL and PT courses show their English name in both languages.

## Structure and access

12. **Resources page.** Keep it or remove it? It is no longer in the menu, and its content is now under Courses › English Learning › English Resources. The page still exists at /resources.html (row 203).
13. **GEMS and SEEDS courses** (EL5004, EL5005, EL5006). The site shows them only to signed-in GEMS or SEEDS scholars, and to staff. Should any of them be public? (rows 143–145)
14. **How Moodle marks staff, GEMS and SEEDS.** In demo mode the roles come from the demo accounts. On the live Moodle connection everyone is treated as a learner until we know whether staff and scholars are marked by a cohort, an ID-number pattern or a profile field. Until then the Training category and scholar-only courses stay hidden on live.
15. **Included / Paid access badge** on course cards. Not built yet, waiting for pricing (row 101).
16. **Tuition link in the menu.** The brief's menu has no Tuition link. It was kept because Max asked for it in every menu on 2026-11-08. Keep it?
17. **Carousel images.** The brief says the carousel images need updating (row 44). The current images are unchanged.
18. **Footer links**: Become a Volunteer, Donate, Partner With Us. Which Pacific Links pages should they open?

## Features

19. **EMMAI** needs an Anthropic API key (`ANTHROPIC_API_KEY` in Netlify) before it answers. Until then it says "EMMAI is switching on soon." The model is set by `EMMAI_MODEL`: the default is Claude Opus 5.5, and Claude Haiku 5.5 is the much cheaper option. **Spend exposure:** the demo login is public and production runs the mock, so once the key is set anyone can use EMMAI on the foundation's bill. Set a monthly spend limit in the Anthropic console first, or keep the key unset until the site runs on live Moodle.
20. **English-through-the-news lessons.** The three lessons on the site are samples, clearly marked as such. Real lessons are drafted by AI in the staff-only Lesson Studio from facts that staff paste in, and nothing is published until a staff member presses Publish in the CMS.
21. **"New event" on the dashboard calendar** saves the event in the learner's own browser only, until the Moodle calendar connection is built.

## Site chrome and home page

22. **Home page picture.** The "What's on GLOW" diagram (`slide2.png`) still shows the old pillars ("Professional Development"). It needs redrawing to match English Learning, Skills & Network Building and Safe Pathways. Its alt text describes the picture as it is today.
23. **Pillar link wording.** The brief has no text for the links under each pillar. The site says "Explore English Learning" / "Khám phá Học tiếng Anh" and so on.
24. **Phone header.** On phones the "In partnership with…" line is hidden in the shell header (no room beside the logo); it is shown on desktop, and in the footer tagline everywhere. On the landing page it is also hidden below 1500px while signed in.
25. **Pillar pictures.** The pictures beside the three pillars on the home page are unchanged. Pillar 02 is now "Skills & Network Building" but still shows the old "Professional Development" slide (`slide4.png`). New pictures are needed for pillars 02 and 03.
