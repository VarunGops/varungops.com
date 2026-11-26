/* The background behind a section page's anatomy: its own full-screen canvas (#bg), behind the anatomy's, started once
   the anatomy is live. It fades in, dims under the words, pauses when the anatomy is well off screen, and gives up
   quietly (data-bg="off") without touching the anatomy if it cannot run. */

// which page has which background
export const BG = { heart: 'rings', hands: 'flow' };

// device pixels per CSS pixel: at most 1.5, and never more than seven million pixels in all
export const canvasScale = (cssW, cssH, dpr) => Math.min(dpr || 1, 1.5, Math.sqrt(7e6 / Math.max(1, cssW * cssH)));

// GLSL shared by the backgrounds: 1 well clear of the words and the link home, a faint haze under the words, a soft
// rounded edge between (the same fade the eyes use). uText and uNav are in canvas pixels from the bottom left.
export const WORDS = `
uniform vec4 uText, uNav;
float box(vec4 r, float round, float soft){
  vec2 c = (r.xy + r.zw)*.5, h = (r.zw - r.xy)*.5, q = abs(gl_FragCoord.xy - c) - h + round;
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - round;
  return smoothstep(0., soft, d);                       // fully dimmed right up to the box's edge, rising outside it
}
float clearOfWords(){ return mix(.15, 1., box(uText, 80., 170.))*box(uNav, 20., 70.); }`;

// the factory for each background, fetched only on its own page; each returns { size(scale), draw(t, view), clear() }
// or null when its shaders cannot be built
const MAKE = {
  rings: () => import('./rings.js').then(m => m.createRings),
  flow: () => import('./flow.js').then(m => m.createFlow),
};

const set = s => { document.documentElement.dataset.bg = s; };
// a box in window pixels, as canvas pixels from the bottom left: [x0, y0, x1, y1]
const flip = (r, s) => (r ? [r.left * s, (innerHeight - r.bottom) * s, r.right * s, (innerHeight - r.top) * s] : [0, 0, 0, 0]);

export async function startBackground({ canvas, host, kind, reduce, fixedAge }) {
  const html = document.documentElement, name = BG[kind], load = name && MAKE[name];
  if (!canvas || !load) { set('off'); return; }
  // the anatomy first: wait until it is live, and stay off if it never is
  const stage = () => html.dataset.stage;
  if (stage() !== 'live') {
    const ok = await new Promise(res => {
      const mo = new MutationObserver(() => { const s = stage(); if (s === 'live' || s === 'still' || s === 'failed') { mo.disconnect(); res(s === 'live'); } });
      mo.observe(html, { attributes: true, attributeFilter: ['data-stage'] });
    });
    if (!ok) { set('off'); return; }
  }
  const lite = innerWidth < 700, preserve = fixedAge != null, once = reduce || preserve;
  let make, bg = null, lost = false, visible = true, scale = 1, last = -1, drawn = false;
  try { make = await load(); bg = make(canvas, { lite, preserve }); } catch (err) { console.warn('the background did not load:', err.message); }
  if (!bg) { set('off'); return; }
  const anchor = host.querySelector('canvas:not(#bg)') || host, words = document.querySelector('.side-body'), nav = document.querySelector('.side-top .home-link');
  const view = () => {
    const a = anchor.getBoundingClientRect();
    // W and H are full-scale canvas pixels, whatever size a background draws at
    return { W: Math.round(innerWidth * scale), H: Math.round(innerHeight * scale), scale, centre: [(a.left + a.width / 2) * scale, (innerHeight - a.top - a.height / 2) * scale],
      text: flip(words && words.getBoundingClientRect(), scale), nav: flip(nav && nav.getBoundingClientRect(), scale) };
  };
  const draw = t => { if (!bg || lost || !visible) return; bg.draw(t, view()); drawn = true; };
  const size = () => { if (!bg || lost) return; scale = canvasScale(innerWidth, innerHeight, devicePixelRatio); bg.size(scale); drawn = false; if (once) draw(fixedAge ?? 0.9); };
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; set('off'); });
  canvas.addEventListener('webglcontextrestored', () => { bg = make(canvas, { lite, preserve }); if (!bg) return; lost = false; size(); set('live'); });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible && bg && !lost) bg.clear(); else if (visible && once) { drawn = false; draw(fixedAge ?? 0.9); }
  }, { rootMargin: '60% 0px' }).observe(host);
  addEventListener('resize', size);
  if (once) addEventListener('scroll', () => { if (visible) draw(fixedAge ?? 0.9); }, { passive: true });   // the words' box moves with the page
  size(); set('live');
  if (once) return;
  const frame = now => { requestAnimationFrame(frame); if (document.hidden || !visible || now - last < 15) return; last = now; draw(now / 1000); };
  requestAnimationFrame(frame);
}
