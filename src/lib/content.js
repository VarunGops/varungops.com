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

// What each section shows on the home page (its heading and a one-line introduction) and on its own page.
// `open` is false when there is nothing to open yet: a draft, or Writing before the first piece.
export async function stopData() {
  const [about, now, life, collab] = await Promise.all(['about', 'now', 'life', 'collaborate'].map(section));
  const research = await getCollection('research'), writing = await getCollection('writing', e => !e.data.draft);
  const count = st => research.filter(e => e.data.status === st).length;
  const tally = ['published', 'in progress', 'presented'].filter(st => count(st)).map(st => `${count(st)} ${st}`).join(' · ');
  const updated = now.entry.data.updated;
  return {
    about: { heading: about.hidden ? 'About me' : about.entry.data.heading, kicker: 'About', intro: about.hidden ? null : about.entry.data.facts, open: !about.hidden,
      description: 'Dr Varun Gopal Rajan in his own words: why surgery, how he works and what he is learning.' },
    now: { heading: now.entry.data.heading, kicker: updated ? `Now · ${monthYear(updated)}` : 'Now', intro: 'MRes Clinical Sciences · University of Liverpool', open: !now.hidden,
      description: 'What Dr Varun Gopal Rajan is working on this month.' },
    'clinical-experience': { heading: 'Wards, theatres and intensive care', kicker: 'Clinical Experience', intro: 'General surgery · Neurosurgery · Trauma and orthopaedics', open: true,
      description: 'Clinical posts of Dr Varun Gopal Rajan in general surgery, neurosurgery and trauma and orthopaedics, in India and the UK, with his CV.' },
    research: { heading: 'Projects and publications', kicker: 'Research', intro: tally, open: true,
      description: 'Research by Dr Varun Gopal Rajan: publications, presentations and current projects.' },
    teaching: { heading: 'Teaching and education', kicker: 'Teaching', intro: 'EduEcho · Case scenarios and skill videos · Simulation and OSCEs', open: true,
      description: 'Teaching by Dr Varun Gopal Rajan: EduEcho, case scenarios and skill videos, simulation and OSCE teaching.' },
    writing: { heading: 'Essays and notes', kicker: 'Writing', intro: null, open: writing.length > 0 || showDrafts(),   // in a drafts preview the page shows while empty, to see its art
      description: 'Essays and notes by Dr Varun Gopal Rajan.' },
    life: { heading: life.entry.data.heading, kicker: 'Life', intro: 'Football · Skating · Music · Cooking · Languages', open: !life.hidden,
      description: 'Dr Varun Gopal Rajan outside medicine.' },
    collaborate: { heading: collab.hidden ? 'Working together' : collab.entry.data.heading, kicker: 'Collaborate', intro: null, open: !collab.hidden,
      description: 'Working with Dr Varun Gopal Rajan on research and teaching.' },
  };
}
