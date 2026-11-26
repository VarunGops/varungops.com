/* A section page's anatomy: the heart on About, the eyes on Now, the hands on Clinical Experience, the lungs on Life. Each runs on its
   own clock, with no burst, and only while it is on screen. The same stage states as the home page: 'live' once a
   frame is drawn, 'still' or 'failed' keep the still image up. */
import { loadPart, decodeEyes, decodeHands, decodeLungs } from './data.js';

const html = document.documentElement, set = s => { html.dataset.stage = s; };
const host = document.querySelector('[data-art]'), kind = host && host.dataset.art;
const canvas = host && host.querySelector('canvas:not(#bg)');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = innerWidth < 700;

// what each piece loads, its renderer (fetched only on its own page), and how it draws; make() returns null when
// its shaders cannot be built
const ART = {
  heart: { part: 'heart', code: () => import('./heart.js'), make: (m, c, d, o) => m.createHeart(c, d, o), draw: (r, t, f) => r.draw(t, 0, f) },
  eyes: { part: lite ? 'eyes-lite' : 'eyes', code: () => import('./eyes.js'), make: (m, c, d, o) => m.createEyes(c, decodeEyes(d.json, d.buf), d.json, { ...o, lite, box: host }), draw: (r, t, f) => r.draw(t, f) },
  lungs: { part: lite ? 'lungs-lite' : 'lungs', code: () => import('./lungs.js'), make: (m, c, d, o) => m.createLungs(c, decodeLungs(d.json, d.buf), d.json, { ...o, box: host }), draw: (r, t, f) => r.draw(t, f) },
  hands: { part: lite ? 'hands-lite' : 'hands', code: () => import('./hands.js'), make: (m, c, d, o) => m.createHands(c, decodeHands(d.json, d.buf), d.json, { ...o, box: host }), draw: (r, t, f) => r.draw(t, f) },
};

// review switches, as on the home page: ?hage= and ?hyaw= fix the moment and the turn, and keep the frame readable
const Q = new URLSearchParams(location.search), num = k => (Q.get(k) == null ? null : +Q.get(k));
const AGE = num('hage'), YAW = num('hyaw'), preserve = AGE != null || YAW != null;
const fixed = { age: AGE != null ? AGE : reduce ? 0.9 : null, yaw: YAW != null ? YAW : reduce ? 0.1 : null };
const STILL = AGE != null && YAW != null;      // both fixed: every frame is the same, so draw once per layout
const webgl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
let art = null, data = null, mod = null, lost = false, visible = true, drawnOnce = false;
const spec = ART[kind];

const draw = t => { if (!art || lost) return; spec.draw(art, t, fixed); drawnOnce = true; set('live'); };
function frame(now) { requestAnimationFrame(frame); if (visible && !(STILL && drawnOnce)) draw(now / 1000); }
const relayout = () => { if (!art || lost) return; art.size(); drawnOnce = false; if (reduce) draw(0); };

async function start() {
  if (!canvas || !spec || !webgl2) { set('still'); return; }
  set('loading');
  try { [data, mod] = await Promise.all([loadPart(spec.part), spec.code()]); } catch (err) { console.warn(`the ${kind} did not load:`, err.message); set('failed'); return; }
  try { art = spec.make(mod, canvas, data, { preserve }); } catch (err) { console.warn(`the ${kind} could not be built:`, err.message); set('failed'); return; }
  if (!art) { set('still'); return; }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; set('still'); });
  canvas.addEventListener('webglcontextrestored', () => { art = spec.make(mod, canvas, data, { preserve }); if (!art) return; lost = false; relayout(); });
  // the eyes' and hands' canvas covers the whole screen, so what decides whether to draw is the box they sit in;
  // once it has scrolled well away the screen is wiped and nothing more is drawn until it comes back
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible && art && art.clear) art.clear(); }, { rootMargin: kind === 'heart' ? '0px' : '60% 0px' }).observe(kind === 'heart' ? canvas : host);
  art.size();
  addEventListener('resize', relayout);
  // a wide piece's canvas is fixed to the screen and its box scrolls: with no loop running, draw again as the page moves
  let queued = false;
  if (reduce || STILL) addEventListener('scroll', () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; drawnOnce = false; if (visible) draw(reduce ? 0 : performance.now() / 1000); }); }, { passive: true });
  if (reduce) draw(0); else requestAnimationFrame(frame);
  // the background behind it, on its own canvas, once the anatomy is drawing (src/stage/bg/layer.js)
  const bgCanvas = document.getElementById('bg');
  if (bgCanvas) import('./bg/layer.js').then(m => m.startBackground({ canvas: bgCanvas, host, kind, reduce, fixedAge: AGE })).catch(err => { html.dataset.bg = 'off'; console.warn('the background did not start:', err.message); });
}
start();
