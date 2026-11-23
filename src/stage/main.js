/* The home stage: lays the brain, the smoke and the heart onto the page and runs the one heartbeat clock they share. */
import { loadAll } from './data.js';
import { prepareBrain, createBrain, SDF_W, SDF_H } from './brain.js';
import { createSmoke } from './smoke.js';
import { createHeart } from './heart.js';
import { T, SPEED, BURST_DELAY, beat, glow } from './clock.js';
import { straightFrom, ZC } from './cord.js';

const html = document.documentElement;
const setStage = s => { html.dataset.stage = s; };
setStage('loading');

const Q = new URLSearchParams(location.search);
const num = k => (Q.get(k) == null ? null : +Q.get(k));
// review switches: ?age= freezes the moment after a volley, ?yaw= fixes the turn, ?hage= ?hyaw= do the same for the heart
const FROZEN = num('age'), YAW = num('yaw'), HEART_AGE = num('hage'), HEART_YAW = num('hyaw');
const NO_SMOKE = Q.get('smoke') === '0', NO_MESH = Q.get('mesh') === '0', NO_TRACTS = Q.get('tracts') === '0';
const preserve = ['age', 'yaw', 'hage', 'hyaw', 'smoke', 'mesh', 'tracts'].some(k => Q.has(k));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// With the moment and the turn both fixed, every frame is identical: draw once per layout and stop.
const STILL_STAGE = FROZEN != null && YAW != null, STILL_HEART = HEART_AGE != null && HEART_YAW != null;
const yawAt = t => (YAW != null ? YAW : reduce ? 0.16 : 0.16 + 0.26 * Math.sin(t * 0.21));

const $ = s => document.querySelector(s);
const home = $('#home'), nameEl = $('.name'), mainEl = $('main'), stageC = $('#stage'), smokeC = $('#smoke');
const heartEl = $('#heart'), track = $('.track'), spine = $('.spine');

let brain = null, smoke = null, heart = null, geom = null, arrive = 5 / SPEED, stageDrawn = false, heartDrawn = false;

function layout() {
  const bodyTop = document.body.getBoundingClientRect().top;
  const W = mainEl.offsetWidth, H = home.offsetHeight;
  const k = Math.min(H * 0.62 / 154, W * 0.94 / 182, 4.6), cx = W / 2, yAnchor = Math.round(H * 0.47);
  const hr = heartEl.getBoundingClientRect(), fieldH = Math.round(hr.top - bodyTop + hr.height * 0.45);
  const sc = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(7e6 / (W * fieldH)));
  const box = [cx - (SDF_W / 2 + 0.5) * k, yAnchor - (SDF_H / 2 - 11) * k, SDF_W * k, SDF_H * k];   // the page rectangle the outline field covers
  geom = { W, H, k, cx, yAnchor, fieldH, box, px: cx - 0.5 * k, py: yAnchor + (ZC - 4) * k, sc };
  nameEl.style.top = yAnchor + 'px';
  stageDrawn = heartDrawn = false;
  const { shape, sEnd } = brain.layout(geom);
  arrive = sEnd / SPEED;                                    // seconds from a beat to its impulse reaching the heart
  if (smoke) smoke.size(geom);
  if (heart) heart.size();
  const lr = $('#last').getBoundingClientRect(), endY = lr.top - bodyTop + lr.height / 2 + 70;
  // the dot rides the line only where the line is straight: from the point the cord has settled onto the page's centre
  const yS = Math.min(straightFrom(shape, yAnchor, k), fieldH - 120);
  Object.assign(track.style, { top: yS + 'px', bottom: 'auto', height: Math.max(0, endY - yS) + 'px' });
  Object.assign(spine.style, { top: fieldH - 80 + 'px', bottom: 'auto', height: Math.max(0, endY - fieldH + 80 + 160) + 'px' });
}

function frame(now) {
  if (!reduce) requestAnimationFrame(frame);
  if (!geom) return;
  const t = reduce ? T * 0.03 : FROZEN != null ? 40 * T + BURST_DELAY + FROZEN : now / 1000;
  const sy = scrollY, vh = innerHeight, { n } = beat(t);
  if (sy < geom.fieldH + 80 && !(STILL_STAGE && stageDrawn)) {
    stageDrawn = true;
    brain.draw(t, reduce ? -1 : n, reduce ? 0.3 : glow(t), yawAt(t), { noMesh: NO_MESH, noTracts: NO_TRACTS });
    if (smoke && !reduce && !NO_SMOKE && sy <= smoke.height) smoke.draw(t, geom, at => Object.assign(brain.outline(yawAt(at)), { w: SDF_W, h: SDF_H }));
  }
  if (heart && sy + vh > geom.fieldH - 500 && sy < geom.fieldH + 600 && !(STILL_HEART && heartDrawn)) {   // the heart fires as each impulse arrives
    heartDrawn = true;
    heart.draw(t, arrive, { age: HEART_AGE != null ? HEART_AGE : reduce ? 0.9 : null, yaw: HEART_YAW != null ? HEART_YAW : reduce ? 0.1 : null });
  }
}

let lw = 0, lh = 0, rt;
function relayout() { lw = mainEl.offsetWidth; lh = home.offsetHeight; layout(); if (reduce) frame(0); }
// a phone's address bar showing or hiding changes the height a little: that does not rebuild the stage
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (geom && (mainEl.offsetWidth !== lw || Math.abs(home.offsetHeight - lh) > 90)) relayout(); }, 180); });

const webgl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();

async function start() {
  if (!webgl2) { setStage('still'); return; }
  let data;
  try { data = await loadAll(mainEl.offsetWidth < 700); } catch (err) { console.warn('anatomy data did not load:', err.message); setStage('failed'); return; }
  const prep = prepareBrain(data);
  brain = createBrain(stageC, prep, { preserve });
  if (!brain) { setStage('still'); return; }
  smoke = createSmoke(smokeC, { preserve });
  heart = createHeart(heartEl, data.heart, { preserve });
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  relayout();
  setStage('live');
  if (!reduce) requestAnimationFrame(frame);
  else addEventListener('scroll', () => frame(0), { passive: true });
}
start();
