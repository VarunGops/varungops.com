/* The scribbles behind the home page: a faint tangle of fine silver lines traced through a 3D curl-noise current
   (curl.js), after Jaume Sánchez's Curl Scribbles (Codevember 2017), written from scratch. It is hidden over the brain
   and its shockwave and fades in as the page scrolls below them; it turns and drifts with the scroll, and turns slowly on
   its own. Drawn three times, a hair apart, in red, green and blue for a slight chromatic split; the CSS gives it a
   vignette, and fades it out rather than sliding it on the way to a section page (view-transition-name: scribbles). */
import { program } from './gl.js';
import { traceScribbles } from './curl.js';

const VS = `#version 300 es
in vec3 aPos; in float aGlow;
uniform mat3 uRot; uniform vec2 uAspect, uShift; uniform float uDist, uDrift;
out float vGlow; out float vDepth;
void main(){
  vec3 p = uRot*aPos; p.y += uDrift;
  float w = uDist - p.z;
  gl_Position = vec4(p.x*uAspect.x + uShift.x*w, p.y*uAspect.y + uShift.y*w, 0., w);
  vGlow = aGlow; vDepth = clamp((p.z + 1.4)/2.8, 0., 1.);
}`;
const FS = `#version 300 es
precision highp float;
in float vGlow; in float vDepth;
uniform vec3 uTint;
out vec4 o;
void main(){ float k = vGlow*(.35 + .65*vDepth); vec3 c = uTint*k; o = vec4(c, k); }`;

export function createBackdrop(canvas, { lite = false, preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, VS, FS); if (!pr) return null;
  const lines = traceScribbles({ lines: lite ? 260 : 520, steps: lite ? 140 : 170, step: 0.021, spread: 0.38, seed: 11 });
  const per = lines[0].length / 3 - 1, segs = lines.length * per, pos = new Float32Array(segs * 6), glow = new Float32Array(segs * 2);
  lines.forEach((L, l) => {
    const b = 0.35 + 0.65 * ((l * 0.618) % 1);                            // each line its own brightness
    for (let i = 0; i < per; i++) {
      const o = l * per + i; pos.set(L.subarray(i * 3, i * 3 + 6), o * 6);
      const fade = Math.sin(Math.PI * i / per), fade2 = Math.sin(Math.PI * (i + 1) / per);   // each line fades in and out along its length
      glow[o * 2] = b * fade; glow[o * 2 + 1] = b * fade2;
    }
  });
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (name, data, size) => { const loc = pr.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
  attr('aPos', pos, 3); attr('aGlow', glow, 1);
  gl.bindVertexArray(null);
  let W = 0, H = 0;
  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), s = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(7e6 / Math.max(1, r.width * r.height)));   // within the same pixel cap as the other canvases
      W = Math.max(2, Math.round(r.width * s)); H = Math.max(2, Math.round(r.height * s));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    },
    // t: seconds; scroll: how far down the page, in pixels below where the scribbles start
    draw(t, scroll) {
      const yaw = t * 0.035 + scroll * 0.0011, pitch = 0.35 * Math.sin(t * 0.021) + scroll * 0.00035;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const R = [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];          // column-major Ry(yaw)·Rx(pitch)
      const fit = 0.82 * Math.max(1, H / W);                                          // the tangle fills the screen's narrower side
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(pr.p); gl.bindVertexArray(vao); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniformMatrix3fv(pr.u.uRot, false, R); gl.uniform2f(pr.u.uAspect, 2.6 * H / W / fit, 2.6 / fit);
      gl.uniform1f(pr.u.uDist, 3.4); gl.uniform1f(pr.u.uDrift, -0.25 + Math.min(0.5, scroll * 0.00012));
      const px = 1.4 / W * 2;                                                        // the colour split: a pixel and a half
      for (const [mask, dx, tint] of [[[true, false, false], -px, [1, 0, 0]], [[false, true, false], 0, [0, 1, 0]], [[false, false, true], px, [0, 0, 1]]]) {
        gl.colorMask(mask[0], mask[1], mask[2], true); gl.uniform2f(pr.u.uShift, dx, 0); gl.uniform3fv(pr.u.uTint, tint.map(v => v * 0.55 + 0.0));
        gl.drawArrays(gl.LINES, 0, segs * 2);
      }
      gl.colorMask(true, true, true, true); gl.bindVertexArray(null);
    },
  };
}

// On the home page: build it once the page is idle, fade it in below the brain's shockwave, redraw at most 30 times a
// second while it shows, and once only when motion is reduced.
export function startBackdrop() {
  const canvas = document.getElementById('scribbles'), home = document.getElementById('home');
  if (!canvas || !home) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Q = new URLSearchParams(location.search), frozen = Q.has('age');         // review frames: no drift of its own
  const webgl2 = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
  if (!webgl2) return;
  let bd = null, last = -1, lost = false, dirty = true;
  const START = 0.9, PEAK = 0.5;                                                  // in screens of the home section; at most half strength
  const shown = () => { const h = home.offsetHeight; return Math.max(0, Math.min(1, (scrollY - START * h) / (0.6 * h))); };   // once the shockwave has gone
  const below = () => Math.max(0, scrollY - START * home.offsetHeight);
  const paint = t => { if (!bd || lost) return; bd.draw(frozen || reduce ? 0 : t, below()); dirty = false; };
  const show = () => { canvas.style.opacity = String(PEAK * shown()); };
  const build = () => {
    bd = createBackdrop(canvas, { lite: innerWidth < 700, preserve: frozen });
    if (!bd) return;
    bd.size(); show(); paint(performance.now() / 1000);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { bd = createBackdrop(canvas, { lite: innerWidth < 700, preserve: frozen }); if (bd) { lost = false; bd.size(); paint(performance.now() / 1000); } });
    addEventListener('resize', () => { if (bd && !lost) { bd.size(); paint(performance.now() / 1000); } });
    addEventListener('scroll', () => { show(); dirty = true; if (reduce || frozen) requestAnimationFrame(() => paint(0)); }, { passive: true });
    if (reduce || frozen) return;
    const loop = now => { requestAnimationFrame(loop); if (now - last < 33 || shown() <= 0 || document.hidden) return; last = now; paint(now / 1000); };
    requestAnimationFrame(loop);
  };
  ('requestIdleCallback' in window ? requestIdleCallback : f => setTimeout(f, 200))(build);
}
