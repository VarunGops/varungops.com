import { getCollection, getEntry } from 'astro:content';

// Draft copy shows in `astro dev`, and in a production build only when SHOW_DRAFTS=1.
// Keyed to Astro's mode, not NODE_ENV, so a build run from a test runner (NODE_ENV=test) still hides drafts.
export const showDrafts = () => import.meta.env.MODE === 'development' || process.env.SHOW_DRAFTS === '1';

export const section = async id => {
  const e = await getEntry('sections', id);
  if (!e) throw new Error(`missing content file src/content/${id}.md`);
  return { entry: e, hidden: !!e.data.draft && !showDrafts() };
};

export const ordered = async name => (await getCollection(name)).sort((a, b) => a.data.order - b.data.order);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = m => { const [y, mo] = m.split('-'); return [MON[+mo - 1], y]; };
// "Jan 2025 – Jan 2026", "Jun – Aug 2025", "Nov 2025", "Sep 2026 – present"
export const span = (start, end) => {
  const [m1, y1] = parts(start);
  if (!end || end === start) return `${m1} ${y1}`;
  if (end === 'present') return `${m1} ${y1} – present`;
  const [m2, y2] = parts(end);
  return y1 === y2 ? `${m1} – ${m2} ${y2}` : `${m1} ${y1} – ${m2} ${y2}`;
};
export const monthYear = m => { const [mo, y] = parts(m); return `${['January','February','March','April','May','June','July','August','September','October','November','December'][MON.indexOf(mo)]} ${y}`; };
