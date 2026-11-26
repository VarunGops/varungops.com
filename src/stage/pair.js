/* The two cells on Teaching: a proofread H01 neuron (amber) and the cell it makes nine real synapses onto (cyan), drawn
   as fine lines as on Research. A signal leaves the first cell's body and runs out along its axon; as it reaches the
   synapses they flash white, and the signal runs on into the second cell from there (signal.js, shared with the
   stream behind them). They turn slowly together (cortex.js). Full-screen canvas fitted to its box. */
import { program } from './gl.js';
import { yaw, PROJECT_GLSL, fitNeuron } from './cortex.js';
import { signalAt, SPEED } from './signal.js';

const VS = `#version 300 es
in vec2 aCorner; in vec3 iA; in vec3 iB; in float iDA; in float iDB; in float iT; in vec3 iDir; in float iCell;
${PROJECT_GLSL}
uniform float uPx; uniform vec2 uMax;
out float vD; out vec3 vDir; out float vSide; out float vTip; out float vCell;
void main(){
  vec4 a = cortex(iA), b = cortex(iB);
  vec2 sa = (a.xy*.5 + .5)*uRes, sb = (b.xy*.5 + .5)*uRes, d = sb - sa; float L = length(d);
  vec2 n = L > 1e-4 ? vec2(-d.y, d.x)/L : vec2(0., 1.);
  float dd = mix(iDA, iDB, aCorner.x), mx = iCell > .5 ? uMax.y : uMax.x, w = mix(1.9, .8, clamp(dd/(mx*.6), 0., 1.))*uPx;
  vec2 p = mix(sa, sb, aCorner.x) + n*aCorner.y*w;
  gl_Position = vec4(p/uRes*2. - 1., mix(a.z, b.z, aCorner.x), 1.);
  vD = dd; vDir = abs(iDir); vSide = aCorner.y; vTip = iT*aCorner.x; vCell = iCell;
}`;
const FS = `#version 300 es
precision highp float;
in float vD; in vec3 vDir; in float vSide; in float vTip; in float vCell;
uniform float uF1, uF2, uSettle, uSpeed;
out vec4 o;
void main(){
  float edge = 1. - smoothstep(.55, 1., abs(vSide));
  float f = vCell > .5 ? uF2 : uF1, x = vD - f;
  float head = f < 0. ? 0. : exp(-x*x/900.)*2.6 + exp(-x*x/8100.)*.7;      // the signal: a bright core in a soft bloom
  float lit = f >= 0. && x < 0. ? exp(x/(uSpeed*.4)) : 0.;                  // where it has just passed
  float tip = vTip > .9 && f >= 0. ? exp(-x*x/324.)*2. : 0.;
  float I = .55 + head + .5*lit*uSettle + tip;
  vec3 base = vCell > .5 ? vec3(.35, .82, 1.) : vec3(1., .62, .26);         // the first cell amber, the second cyan
  vec3 col = mix(base, normalize(vDir + .1), .22);                          // a little of the brain's direction colours
  col = mix(col, vec3(1., .97, .92), clamp((head + tip)*.4, 0., 1.)*.55);
  vec3 c = col*I*edge;
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;
// the synapses and the two cell bodies, as soft discs
const DOT_VS = `#version 300 es
in vec4 aDot;                                   // x y z, kind: 0 synapse, 1 first cell body, 2 second cell body
${PROJECT_GLSL}
uniform float uPx, uFlash, uGlow1, uGlow2;
out float vK; out float vKind;
void main(){
  gl_Position = cortex(aDot.xyz);
  float k = aDot.w < .5 ? uFlash : aDot.w < 1.5 ? uGlow1 : uGlow2;
  gl_PointSize = (aDot.w < .5 ? 7. + 16.*uFlash : 15.)*uPx; vK = k; vKind = aDot.w;
}`;
const DOT_FS = `#version 300 es
precision highp float;
in float vK; in float vKind; out vec4 o;
void main(){
  vec2 q = gl_PointCoord*2. - 1.; float r = dot(q, q);
  vec3 col = vKind < .5 ? vec3(1.) : vKind < 1.5 ? vec3(1., .78, .5) : vec3(.6, .9, 1.);
  float a = exp(-r*4.)*(vKind < .5 ? .15 + 1.6*vK : .5 + 1.3*vK);
  vec3 c = col*a; o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export function createPair(canvas, data, { preserve = false, box = canvas } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, VS, FS), dots = program(gl, DOT_VS, DOT_FS); if (!pr || !dots) return null;
  const j = data.json, maxD = j.maxDist;
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const cl = pr.a('aCorner'); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data.seg, gl.STATIC_DRAW);
  for (const [name, size, off] of [['iA', 3, 0], ['iB', 3, 3], ['iDA', 1, 6], ['iDB', 1, 7], ['iT', 1, 9], ['iDir', 3, 10], ['iCell', 1, 13]]) {
    const l = pr.a(name); if (l < 0) continue; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 56, off * 4); gl.vertexAttribDivisor(l, 1);
  }
  const dvao = gl.createVertexArray(); gl.bindVertexArray(dvao);
  const D = [...j.synapses.map(p => [...p, 0]), [...j.somas[0], 1], [...j.somas[1], 2]].flat();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(D), gl.STATIC_DRAW);
  const dl = dots.a('aDot'); gl.enableVertexAttribArray(dl); gl.vertexAttribPointer(dl, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  let vw = 0, vh = 0, sc = 1;
  const clear = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  const cam = (u, fit, a) => { gl.uniform3f(u.uFit, fit.s, fit.cx, fit.cy); gl.uniform1f(u.uYaw, a); gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform1f(u.uPx, sc); };
  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = r.width; vh = r.height; sc = Math.min(dpr, Math.sqrt(7e6 / Math.max(1, vw * vh)));
      const W = Math.max(2, Math.round(vw * sc)), H = Math.max(2, Math.round(vh * sc));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    },
    clear,
    draw(t, fixed = {}) {
      const time = fixed.age != null ? fixed.age : t, a = fixed.yaw != null ? fixed.yaw : yaw(time), s = signalAt(time, j.dSyn, maxD);
      const fit = fitNeuron(box.getBoundingClientRect(), sc, data.lo, data.hi);
      clear(); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pr.p); gl.bindVertexArray(vao); cam(pr.u, fit, a);
      gl.uniform2f(pr.u.uMax, maxD[0], maxD[1]); gl.uniform1f(pr.u.uF1, s.front1); gl.uniform1f(pr.u.uF2, s.front2); gl.uniform1f(pr.u.uSettle, s.settle); gl.uniform1f(pr.u.uSpeed, SPEED);
      gl.blendEquation(gl.MAX); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, data.nseg); gl.blendEquation(gl.FUNC_ADD);
      gl.useProgram(dots.p); gl.bindVertexArray(dvao); cam(dots.u, fit, a);
      gl.uniform1f(dots.u.uFlash, s.flash); gl.uniform1f(dots.u.uGlow1, Math.exp(-s.ph * 3)); gl.uniform1f(dots.u.uGlow2, s.front2 < 0 ? 0 : Math.exp(-s.front2 / 120));
      gl.drawArrays(gl.POINTS, 0, D.length / 4);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
