/* Teaching's background: a stream of particles carried by a curl-noise current across the screen, from the first cell's
   side to the second's, along the line through their two cell bodies, after Jaume Sánchez's Plasma waves (Codevember
   2017, CC BY 4.0), written afresh. Amber where it leaves, cyan where it arrives; it brightens and quickens for a
   moment as the signal crosses the synapses (signal.js). The particles live in the stream's own frame (along the line,
   across it), so it stays on the cells as the page scrolls and they turn. */
import { program } from '../gl.js';
import { yaw, project, fitNeuron } from '../cortex.js';
import { signalAt } from '../signal.js';
import { noise3 } from '../curl.js';
import { WORDS } from './layer.js';

const VS = `#version 300 es
in vec2 aP; in float aA; in float aK; uniform vec2 uRes;
out float vA; out float vK;
void main(){ vA = aA; vK = aK; gl_Position = vec4(aP/uRes*2. - 1., 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
in float vA; in float vK; uniform float uGain;
${WORDS}
out vec4 o;
void main(){ vec3 col = mix(vec3(1., .62, .26), vec3(.35, .82, 1.), vK); vec3 c = col*vA*uGain*clearOfWords(); o = vec4(c, max(c.r, max(c.g, c.b))); }`;

const STEP = 1 / 60;

export function createStream(canvas, { lite = false, preserve = false } = {}, data) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl || !data) return null;
  const pr = program(gl, VS, FS); if (!pr) return null;
  const j = data.json, N = lite ? 900 : 2200;
  const P = new Float32Array(N * 2), Q = new Float32Array(N * 2), L = new Float32Array(N);   // along/across (px of the stream), the step before, life
  const verts = new Float32Array(N * 2 * 4);
  const vao = gl.createVertexArray(), buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, verts.byteLength, gl.DYNAMIC_DRAW);
  for (const [n, size, off] of [['aP', 2, 0], ['aA', 1, 2], ['aK', 1, 3]]) { const l = pr.a(n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 16, off * 4); }
  gl.bindVertexArray(null);
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let half = 1000, simT = null, warmT = null;
  const spawn = (i, anywhere) => { P[i * 2] = anywhere ? (rnd() * 2 - 1) * half : -half - rnd() * 60; P[i * 2 + 1] = (rnd() * 2 - 1) * 70 * (0.4 + 0.6 * rnd()); Q[i * 2] = P[i * 2]; Q[i * 2 + 1] = P[i * 2 + 1]; L[i] = 1; };
  const reset = () => { seed = 7; for (let i = 0; i < N; i++) spawn(i, true); };
  // one step: drift along the line, swirled by the current; a little faster and fuller as the signal crosses
  const step = (t, boost) => {
    const v = 2.2 * (1 + 1.2 * boost);
    for (let i = 0; i < N; i++) {
      const x = P[i * 2], y = P[i * 2 + 1]; Q[i * 2] = x; Q[i * 2 + 1] = y;
      const f = 0.0045, z = t * 0.08, e = 0.5, n = (X, Y) => noise3(X * f, Y * f, z, 5);
      const sx = (n(x, y + e) - n(x, y - e)) / (2 * e), sy = -(n(x + e, y) - n(x - e, y)) / (2 * e);   // the curl of a 2D field: it swirls, never pools
      P[i * 2] = x + v + sx * 260; P[i * 2 + 1] = y + sy * 260 - y * 0.004;        // gently held to the line
      if (P[i * 2] > half + 40) spawn(i, false);
    }
  };
  const clear = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    size(scale) {
      const W = Math.max(2, Math.round(canvas.clientWidth * scale)), H = Math.max(2, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      half = Math.hypot(W, H) / 2 / Math.max(1, scale) + 40; warmT = null; simT = null;
    },
    clear,
    draw(t, v) {
      const fit = fitNeuron(v.rect, v.scale, data.lo, data.hi), a = v.fixedYaw != null ? v.fixedYaw : yaw(t);
      const A = project(j.somas[0], a, fit), B = project(j.somas[1], a, fit);
      let ux = B[0] - A[0], uy = -(B[1] - A[1]); const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;   // the line, bottom-left origin
      const mid = [(A[0] + B[0]) / 2, v.H - (A[1] + B[1]) / 2];
      const sig = s => { const g = signalAt(s, j.dSyn, j.maxDist); return Math.exp(-Math.pow((g.ph - g.tSyn) / 0.45, 2)); };
      // a fixed moment is warmed up once over the 4 s before it, from the same start; running, it steps with the clock
      if (preserve ? warmT !== t : (simT == null || t - simT > 0.5)) { reset(); simT = t - 4; warmT = t; }
      let k = 0; while (simT + STEP <= t && k++ < 260) { simT += STEP; step(simT, sig(simT)); }
      const boost = sig(t), s = v.scale;
      for (let i = 0; i < N; i++) {
        const along = P[i * 2] / half, fade = Math.max(0, 1 - Math.abs(along) ** 4);
        const kk = Math.min(1, Math.max(0, along * 0.5 + 0.5)), al = fade * (0.35 + 0.65 * boost);
        for (const [w, src] of [[0, Q], [1, P]]) {
          const x = src[i * 2] * s, y = src[i * 2 + 1] * s, o = (i * 2 + w) * 4;
          const X = w ? x : P[i * 2] * s + (Q[i * 2] - P[i * 2]) * s * 7, Y = w ? y : P[i * 2 + 1] * s + (Q[i * 2 + 1] - P[i * 2 + 1]) * s * 7;   // a trail seven steps long
          verts[o] = mid[0] + ux * X - uy * Y; verts[o + 1] = mid[1] + uy * X + ux * Y; verts[o + 2] = al * (w ? 1 : 0); verts[o + 3] = kk;
        }
      }
      clear(); gl.useProgram(pr.p); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
      gl.uniform2f(pr.u.uRes, canvas.width, canvas.height); gl.uniform1f(pr.u.uGain, lite ? 1.2 : 1.0); gl.uniform4fv(pr.u.uText, v.text); gl.uniform4fv(pr.u.uNav, v.nav);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.LINES, 0, N * 2); gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
