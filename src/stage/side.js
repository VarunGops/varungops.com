/* A section page's anatomy: for now the heart on About. It beats on its own clock, with no burst, and only while
   it is on screen. The same stage states as the home page: 'live' once a frame is drawn, 'still' or 'failed' keep
   the still image up. */
import { loadPart } from './data.js';
import { createHeart } from './heart.js';

const html = document.documentElement, set = s => { html.dataset.stage = s; };
set('loading');
const canvas = document.querySelector('#heart');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
// review switches, as on the home page: ?hage= and ?hyaw= fix the moment and the turn, and keep the frame readable
const Q = new URLSearchParams(location.search), num = k => (Q.get(k) == null ? null : +Q.get(k));
const AGE = num('hage'), YAW = num('hyaw'), preserve = AGE != null || YAW != null;
const fixed = { age: AGE != null ? AGE : reduce ? 0.9 : null, yaw: YAW != null ? YAW : reduce ? 0.1 : null };
let heart = null, data = null, lost = false, visible = true;

const draw = t => { if (!heart || lost) return; heart.draw(t, 0, fixed); set('live'); };
function frame(now) { requestAnimationFrame(frame); if (visible) draw(now / 1000); }

async function start() {
  if (!canvas || !webgl2) { set('still'); return; }
  try { data = await loadPart('heart'); } catch (err) { console.warn('the heart did not load:', err.message); set('failed'); return; }
  heart = createHeart(canvas, data, { preserve });
  if (!heart) { set('still'); return; }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; set('still'); });
  canvas.addEventListener('webglcontextrestored', () => { heart = createHeart(canvas, data, { preserve }); if (!heart) return; lost = false; heart.size(); if (reduce) draw(0); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  heart.size();
  addEventListener('resize', () => { if (!heart || lost) return; heart.size(); if (reduce) draw(0); });
  if (reduce) draw(0); else requestAnimationFrame(frame);
}
start();
