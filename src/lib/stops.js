// The sections below the heart, in page order. Each opens its own page, sliding in from the side its introduction
// sits on: About from the right, Now from the left, and so on down the line. `art` names the anatomy drawn at the
// top of that page (null until it is built). Plain data, so the tests and the page script can both read it.
export const STOPS = [
  { id: 'about', label: 'About', path: '/about/', art: 'heart' },
  { id: 'now', label: 'Now', path: '/now/', art: null },
  { id: 'clinical-experience', label: 'Clinical Experience', path: '/clinical-experience/', art: null },
  { id: 'research', label: 'Research', path: '/research/', art: null },
  { id: 'teaching', label: 'Teaching', path: '/teaching/', art: null },
  { id: 'writing', label: 'Writing', path: '/writing/', art: null },
  { id: 'life', label: 'Life', path: '/life/', art: null },
  { id: 'collaborate', label: 'Collaborate', path: '/collaborate/', art: null },
].map((s, i) => ({ ...s, side: i % 2 ? 'left' : 'right' }));

export const CONTACT_SIDE = STOPS.length % 2 ? 'left' : 'right';
export const SIDES = Object.fromEntries(STOPS.map(s => [s.path, s.side]));
export const stop = id => STOPS.find(s => s.id === id);

// Which way the arriving page moves in. Self-contained: the page copies this function's source into an inline script.
export function direction(from, to, sides) {
  if (from === '/' && sides[to]) return 'from-' + sides[to];
  if (to === '/' && sides[from]) return sides[from] === 'right' ? 'from-left' : 'from-right';
  return null;
}
