/* The neuron on Research: H01 cell 3955003482, a pyramidal neuron from the human cortex, drawn as fine branching lines
   in the brain's direction colours (red across, green up and down, blue towards you, softened towards a warm white).
   On a slow cycle, light leaves the cell body and runs out along every branch to its tips, then the cell fades back
   to rest. It turns slowly (cortex.js, shared with the cells behind it). Full-screen canvas fitted to its box. */
import { program } from './gl.js';
import { yaw, PROJECT_GLSL, fitNeuron } from './cortex.js';

export const CYCLE = 7, RUN = 4;          // seconds: the light runs out over RUN, then the cell settles for the rest

const VS = `#version 300 es
in vec2 aCorner; in vec3 iA; in vec3 iB; in float iDA; in float iDB; in float iR;
${PROJECT_GLSL}
uniform float uPx;
out float vD; out vec3 vDir; out float vSide;
void main(){
  vec4 a = cortex(iA), b = cortex(iB);
  vec2 sa = (a.xy*.5 + .5)*uRes, sb = (b.xy*.5 + .5)*uRes, d = sb - sa; float L = length(d);
  vec2 n = L > 1e-4 ? vec2(-d.y, d.x)/L : vec2(0., 1.);
  float w = clamp(iR*uFit.x*1.4, 1.1*uPx, 5.*uPx);          // as thick as the branch, never under a hairline
  vec2 p = mix(sa, sb, aCorner.x) + n*aCorner.y*w;
  gl_Position = vec4(p/uRes*2. - 1., mix(a.z, b.z, aCorner.x), 1.);
  vD = mix(iDA, iDB, aCorner.x); vDir = abs(normalize(iB - iA + 1e-6)); vSide = aCorner.y;
}`;
const FS = `#version 300 es
precision highp float;
in float vD; in vec3 vDir; in float vSide;
uniform float uFront, uSettle, uMax;
out vec4 o;
void main(){
  float edge = 1. - smoothstep(.55, 1., abs(vSide));
  float head = exp(-pow((vD - uFront)/60., 2.));                       // the light, at the front
  float lit = vD < uFront ? exp(-(uFront - vD)/260.) : 0.;            // and the branches it has passed, still glowing
  float I = .5 + 1.6*head + .7*lit*uSettle;
  vec3 col = mix(vec3(1., .93, .85), normalize(vDir + .15), .82);      // the brain's direction colours, a little softened
  col = mix(col, vec3(1., .97, .9), head*.6);
  vec3 c = col*I*edge;
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export function createNeuron(canvas, data, { preserve = false, box = canvas } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, VS, FS); if (!pr) return null;
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const cl = pr.a('aCorner'); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data.seg, gl.STATIC_DRAW);
  for (const [name, size, off] of [['iA', 3, 0], ['iB', 3, 3], ['iDA', 1, 6], ['iDB', 1, 7], ['iR', 1, 8]]) {
    const l = pr.a(name); if (l < 0) continue; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 40, off * 4); gl.vertexAttribDivisor(l, 1);
  }
  gl.bindVertexArray(null);
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
      gl.uniform1f(u.uFront, front); gl.uniform1f(u.uSettle, settle); gl.uniform1f(u.uMax, data.maxDist);
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, data.nseg);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
