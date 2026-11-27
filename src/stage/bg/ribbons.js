/* Writing's background: flowing line ribbons, after Jaume Sánchez's Strange Attractors (Codevember 2016, CC BY 4.0),
   written afresh. A few hundred trajectories of the Lorenz attractor start a hair apart and spread across both wings,
   so their lines run side by side in sheets that loop back on themselves. They are drawn in the tract colours (each
   line's own direction, as on the arcuate in front), with bands of light running along them, and turn slowly. Quieter
   behind the brain and under the words. */
import { program } from '../gl.js';
import { WORDS } from './layer.js';

// n Lorenz trajectories of len points each (x y z, the attractor's own units), every `every` RK4 steps of dt. They all
// start within `r` of one point already on the attractor, so they set out as one ribbon and fan out. Seeded: always
// the same.
export function attractor({ n, len, every = 4, dt = 0.005, r = 0.05, seed = 3 }) {
  const f = (p, o) => { o[0] = 10 * (p[1] - p[0]); o[1] = p[0] * (28 - p[2]) - p[1]; o[2] = p[0] * p[1] - (8 / 3) * p[2]; };
  const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0], q = [0, 0, 0];
  const rk4 = p => {
    f(p, k1); for (let j = 0; j < 3; j++) q[j] = p[j] + k1[j] * dt / 2;
    f(q, k2); for (let j = 0; j < 3; j++) q[j] = p[j] + k2[j] * dt / 2;
    f(q, k3); for (let j = 0; j < 3; j++) q[j] = p[j] + k3[j] * dt;
    f(q, k4); for (let j = 0; j < 3; j++) p[j] += (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) * dt / 6;
  };
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const p0 = [0.1, 0, 0]; for (let i = 0; i < 2000; i++) rk4(p0);   // onto the attractor
  const pos = new Float32Array(n * len * 3);
  for (let i = 0; i < n; i++) {
    const p = p0.map(c => c + (rnd() * 2 - 1) * r);
    for (let k = 0; k < len; k++) {
      const o = (i * len + k) * 3; pos[o] = p[0]; pos[o + 1] = p[1]; pos[o + 2] = p[2];
      for (let e = 0; e < every; e++) rk4(p);
    }
  }
  return { pos, n, len };
}

const VS = `#version 300 es
in vec3 aP; in vec3 aDir; in float aS;
uniform vec2 uRes, uC; uniform float uScale, uYaw;
out vec3 vDir; out float vS; out float vZ;
void main(){
  vec3 p = aP - vec3(0., 0., 25.);
  float c = cos(uYaw), s = sin(uYaw);
  vec3 q = vec3(c*p.x + s*p.y, p.z, -s*p.x + c*p.y);                // the butterfly upright (z up), turning about its upright
  float t = -.6, ct = cos(t), st = sin(t);
  vec2 xy = vec2(ct*q.x - st*q.y, st*q.x + ct*q.y);                  // leant over, so its middle runs corner to corner as in the demo
  float persp = 60./(60. + q.z);
  gl_Position = vec4((uC + xy*uScale*persp)/uRes*2. - 1., 0., 1.);
  vDir = aDir; vS = aS; vZ = q.z;
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vDir; in float vS; in float vZ;
uniform float uT, uGain; uniform vec4 uArt;
${WORDS}
out vec4 o;
void main(){
  float band = pow(.5 + .5*sin(6.2832*(vS*5. - uT*.05)), 6.);       // light running along every line in step
  float I = (.3 + 1.2*band)*smoothstep(.22, .42, vS)*smoothstep(1., .9, vS)*mix(1., .55, clamp(vZ/25., 0., 1.));   // from where they have spread to the end; the far side fainter
  vec3 col = mix(vec3(.85), abs(vDir), .55);                         // the tract colours, softened
  vec3 c = col*I*uGain*clearOfWords()*mix(.4, 1., box(uArt, 40., 160.));   // quieter behind the brain
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export function createRibbons(canvas, { lite = false, preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, VS, FS); if (!pr) return null;
  const { pos, n, len } = attractor({ n: lite ? 90 : 180, len: 700 });
  // each point with its direction of travel and how far along its line it is
  const v = new Float32Array(n * len * 7);
  for (let i = 0; i < n; i++) for (let k = 0; k < len; k++) {
    const a = (i * len + Math.max(0, k - 1)) * 3, b = (i * len + Math.min(len - 1, k + 1)) * 3, o = (i * len + k) * 7;
    const d = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], l = Math.hypot(...d) || 1;
    v[o] = pos[(i * len + k) * 3]; v[o + 1] = pos[(i * len + k) * 3 + 1]; v[o + 2] = pos[(i * len + k) * 3 + 2];
    v[o + 3] = d[0] / l; v[o + 4] = d[1] / l; v[o + 5] = d[2] / l; v[o + 6] = k / (len - 1);
  }
  const idx = new Uint32Array(n * (len - 1) * 2);
  for (let i = 0, m = 0; i < n; i++) for (let k = 0; k < len - 1; k++) { idx[m++] = i * len + k; idx[m++] = i * len + k + 1; }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  for (const [name, size, off] of [['aP', 3, 0], ['aDir', 3, 3], ['aS', 1, 6]]) { const l = pr.a(name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 28, off * 4); }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const clear = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    size(scale) { const W = Math.max(2, Math.round(canvas.clientWidth * scale)), H = Math.max(2, Math.round(canvas.clientHeight * scale)); if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; } },
    clear,
    draw(t, view) {
      clear(); gl.useProgram(pr.p); gl.bindVertexArray(vao);
      const W = canvas.width, H = canvas.height, c = view.centre, a = view.anchor;
      gl.uniform2f(pr.u.uRes, W, H); gl.uniform2f(pr.u.uC, c[0], c[1]);
      gl.uniform1f(pr.u.uScale, Math.max(W, H) / 44);                                     // both wings and their crossing, filling the screen as in the demo
      gl.uniform1f(pr.u.uYaw, 0.5 + (view.fixedYaw != null ? view.fixedYaw : 0.35 * Math.sin(2 * Math.PI * t / 60)));
      gl.uniform1f(pr.u.uT, t); gl.uniform1f(pr.u.uGain, lite ? 0.2 : 0.13);
      gl.uniform4f(pr.u.uArt, c[0] - a[0] * 0.3, c[1] - a[1] * 0.4, c[0] + a[0] * 0.3, c[1] + a[1] * 0.4);
      gl.uniform4fv(pr.u.uText, view.text); gl.uniform4fv(pr.u.uNav, view.nav);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawElements(gl.LINES, idx.length, gl.UNSIGNED_INT, 0); gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
