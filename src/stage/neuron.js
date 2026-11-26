/* The neuron on Research: H01 cell 3955003482, a pyramidal neuron from the human cortex, drawn as fine branching lines
   in the brain's direction colours (red across, green up and down, blue towards you, softened towards a warm white).
   On a slow cycle, light leaves the cell body and runs out along every branch to its tips, then the cell fades back
   to rest. It turns slowly (cortex.js, shared with the cells behind it). Full-screen canvas fitted to its box. */
import { program } from './gl.js';
import { yaw, PROJECT_GLSL, fitNeuron } from './cortex.js';

export const CYCLE = 6, RUN = 3;        // seconds: the light runs out over RUN, then the cell rests for the remainder

const VS = `#version 300 es
in vec2 aCorner; in vec3 iA; in vec3 iB; in float iDA; in float iDB; in float iT; in vec3 iDir;
${PROJECT_GLSL}
uniform float uPx, uMax;
out float vD; out vec3 vDir; out float vSide; out float vTip;
void main(){
  vec4 a = cortex(iA), b = cortex(iB);
  vec2 sa = (a.xy*.5 + .5)*uRes, sb = (b.xy*.5 + .5)*uRes, d = sb - sa; float L = length(d);
  vec2 n = L > 1e-4 ? vec2(-d.y, d.x)/L : vec2(0., 1.);
  float dd = mix(iDA, iDB, aCorner.x), w = mix(2., .8, clamp(dd/(uMax*.6), 0., 1.))*uPx;   // thick at the trunk, fine at the tips
  vec2 p = mix(sa, sb, aCorner.x) + n*aCorner.y*w;
  gl_Position = vec4(p/uRes*2. - 1., mix(a.z, b.z, aCorner.x), 1.);
  vD = dd; vDir = abs(iDir); vSide = aCorner.y; vTip = iT*aCorner.x;
}`;
const FS = `#version 300 es
precision highp float;
in float vD; in vec3 vDir; in float vSide; in float vTip;
uniform float uFront, uSettle, uSpeed;
out vec4 o;
void main(){
  float edge = 1. - smoothstep(.55, 1., abs(vSide));
  float x = vD - uFront;
  float head = (exp(-x*x/900.)*3. + exp(-x*x/8100.)*.8)*mix(.6, 1., smoothstep(80., 350., vD));   // a bright core in a softer bloom, gentler among the crowded basal branches
  float lit = x < 0. ? exp(x/(uSpeed*.35)) : 0.;                       // the branches it has just passed, fading within a third of a second
  float tip = vTip > .9 ? exp(-x*x/324.)*3. : 0.;                      // a flash as it reaches a tip
  float I = .6 + head + .55*lit*uSettle + tip;
  vec3 col = mix(vec3(1., .93, .85), normalize(vDir + .08), .75);      // the brain's direction colours
  col = mix(col, vec3(1., .97, .92), clamp((head + tip)*.4, 0., 1.)*.55);   // the light whitens a branch, but its colour stays
  vec3 c = col*I*edge;
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;
// the cell body: a soft disc at the soma, brightest as the light leaves it
const SOMA_VS = `#version 300 es
${PROJECT_GLSL}
uniform float uR;
void main(){ gl_Position = cortex(vec3(0.)); gl_PointSize = uR; }`;
const SOMA_FS = `#version 300 es
precision highp float;
uniform float uGlow; out vec4 o;
void main(){ vec2 q = gl_PointCoord*2. - 1.; float k = exp(-dot(q, q)*4.)*(.55 + 1.4*uGlow); vec3 c = vec3(1., .95, .88)*k; o = vec4(c, max(c.r, max(c.g, c.b))); }`;

export function createNeuron(canvas, data, { preserve = false, box = canvas } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, VS, FS), soma = program(gl, SOMA_VS, SOMA_FS); if (!pr || !soma) return null;
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const cl = pr.a('aCorner'); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data.seg, gl.STATIC_DRAW);
  for (const [name, size, off] of [['iA', 3, 0], ['iB', 3, 3], ['iDA', 1, 6], ['iDB', 1, 7], ['iT', 1, 9], ['iDir', 3, 10]]) {
    const l = pr.a(name); if (l < 0) continue; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 52, off * 4); gl.vertexAttribDivisor(l, 1);
  }
  gl.bindVertexArray(null);
  const svao = gl.createVertexArray();
  let vw = 0, vh = 0, sc = 1;
  const clear = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
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
      const time = fixed.age != null ? fixed.age : t, a = fixed.yaw != null ? fixed.yaw : yaw(time), ph = ((time % CYCLE) + CYCLE) % CYCLE;
      const front = ph < RUN ? ph / RUN * data.maxDist * 1.1 : data.maxDist * 1.1, settle = ph < RUN ? 1 : Math.max(0, 1 - (ph - RUN) / (CYCLE - RUN));
      const fit = fitNeuron(box.getBoundingClientRect(), sc, data.lo, data.hi);
      clear(); gl.useProgram(pr.p); gl.bindVertexArray(vao);
      const u = pr.u;
      gl.uniform3f(u.uFit, fit.s, fit.cx, fit.cy); gl.uniform1f(u.uYaw, a); gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform1f(u.uPx, sc);
      gl.uniform1f(u.uFront, front); gl.uniform1f(u.uSettle, settle); gl.uniform1f(u.uMax, data.maxDist); gl.uniform1f(u.uSpeed, data.maxDist * 1.1 / RUN);
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.blendEquation(gl.MAX);   // overlapping ends do not add up to bright specks
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, data.nseg); gl.blendEquation(gl.FUNC_ADD);
      gl.useProgram(soma.p); gl.bindVertexArray(svao);
      gl.uniform3f(soma.u.uFit, fit.s, fit.cx, fit.cy); gl.uniform1f(soma.u.uYaw, a); gl.uniform2f(soma.u.uRes, canvas.width, canvas.height);
      gl.uniform1f(soma.u.uR, Math.max(10 * sc, 26 * fit.s)); gl.uniform1f(soma.u.uGlow, ph < RUN ? Math.exp(-ph * 3) : 0);
      gl.drawArrays(gl.POINTS, 0, 1);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
