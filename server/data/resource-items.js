/* The Resources page's items, as the brief words them. glow-catalogue.js is
   generated from the old crawl, so the brief's changes live here: one place
   read by both the static page (tools/build-pages.mjs) and /api/catalog/resources.
   An item is { title, titleVi?, courseId?, code?, emmai?, href? }. */
import { courseByMoodleId, canSee } from './catalogue.js';

const EMMAI = { 1986: { title: 'EMMAI — AI advisor', titleVi: 'EMMAI — cố vấn AI', emmai: true } };
const ENGLISH_LIBRARY = {
  courseId: 4, title: 'English Library', titleVi: 'Thư viện tiếng Anh',
  href: 'https://glow.mata9.com/course/view.php?id=4',
};

/* A PUBLIC new-catalogue course links to its page by code; gated ones and the
   rest keep the old id, so the public page never links a course it would 404. */
export function resourceItem(item) {
  if (EMMAI[item.courseId]) return { ...item, ...EMMAI[item.courseId] };
  const c = courseByMoodleId(item.courseId);
  return c && canSee(c, null) ? { ...item, code: c.code } : item;
}

export function resourceItems(items) {
  const out = items.map(resourceItem);
  return out.some(i => i.courseId === 4) ? out : [...out, ENGLISH_LIBRARY];
}

/* Apply to /api/catalog/resources: only the group that holds the resources. */
export function resourceGroups(groups) {
  return groups.map(g => (g.items.some(i => i.courseId === 1986) ? { ...g, items: resourceItems(g.items) } : g));
}
