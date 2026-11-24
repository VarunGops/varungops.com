/* A section page's anatomy: the heart on About, the eyes on Now, the hands on Clinical Experience. Each runs on its
   own clock, with no burst, and only while it is on screen. The same stage states as the home page: 'live' once a
   frame is drawn, 'still' or 'failed' keep the still image up. */
import { loadPart, decodeEyes } from './data.js';

const html = document.documentElement, set = s => { html.dataset.stage = s; };
const host = document.querySelector('[data-art]'), kind = host && host.dataset.art;
const canvas = host && host.querySelector('canvas');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = innerWidth < 700;

// what each piece loads, its renderer (fetched only on its own page), and how it draws; make() returns null when
// its shaders cannot be built
const ART = {
  heart: { part: 'heart', code: () => import('./heart.js'), make: (m, c, d, o) => m.createHeart(c, d, o), draw: (r, t, f) => r.draw(t, 0, f) },
  eyes: { part: lite ? 'eyes-lite' : 'eyes', code: () => import('./eyes.js'), make: (m, c, d, o) => m.createEyes(c, decodeEyes(d.json, d.buf), d.json, { ...o, lite }), draw: (r, t, f) => r.draw(t, f) },
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
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  art.size();
  addEventListener('resize', relayout);
  if (reduce) draw(0); else requestAnimationFrame(frame);
}
start();
