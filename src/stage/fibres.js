/* A single white-matter tract on a section page, from the HCP-1065 atlas: Writing's left arcuate fasciculus, seen from
   the left inside a faint outline of the brain, and Collaborate's corpus callosum, seen from above. Each streamline is
   drawn as a fine line in the standard tractography colours (left-right red, front-back green, up-down blue), with
   light running along it: on Writing one pulse from the frontal end to the temporal and one returning; on
   Collaborate one crossing the midline on every heartbeat (clock.js), alternating sides, full on the volley. The
   streamlines come oriented from prep (frontal end first; left end first). Full-screen canvas fitted to its box. */
import { program } from './gl.js';
import { beat, amp, T } from './clock.js';

export const WRITE_CYCLE = 6;

// positions along the tract (0 frontal end, 1 temporal) of the forward pulse and the returning one
export function writingPulses(t) {
  const p = ((t % WRITE_CYCLE) + WRITE_CYCLE) % WRITE_CYCLE / WRITE_CYCLE;
  return { fwd: p * 1.2 - 0.1, back: 1.1 - ((p + 0.5) % 1) * 1.2 };
}

// the light crossing the corpus callosum on this beat: where it is (0 left end, 1 right), which way, how strong
export function crossing(t) {
  const { n, a } = beat(t), dir = n % 2 === 0 ? 1 : -1, p = Math.min(1.2, a / (0.75 * T)) - 0.1;
  return { s: dir > 0 ? p : 1 - p, dir, amp: amp(n) };
}

const VIEW = {
  // MNI mm to view space (x right on screen, y up, z towards the viewer)
  lateralLeft: p => [-p[1], p[2], -p[0]],   // seen from the left: frontal lobe on the left of the screen
  top: p => [p[0], p[1], p[2]],             // seen from above: the front of the brain up the screen
};
const CAMERA = 700;

const LINE_VS = `#version 300 es
in vec2 aCorner; in vec3 iA; in vec3 iB; in float iS; in float iSeed;
uniform vec2 uRes; uniform vec3 uFit; uniform float uYaw, uPx;
out float vS; out vec3 vDir; out float vSide; out float vSeed;
vec4 proj(vec3 p){
  float c = cos(uYaw), s = sin(uYaw), xr = p.x*c + p.z*s, zr = -p.x*s + p.z*c, f = ${CAMERA}./(${CAMERA}. - zr);
  vec2 q = vec2(uFit.y + xr*uFit.x*f, uFit.z - p.y*uFit.x*f);
  return vec4(q.x/uRes.x*2. - 1., 1. - q.y/uRes.y*2., 0., 1.);
}
void main(){
  vec4 a = proj(iA), b = proj(iB);
  vec2 sa = (a.xy*.5 + .5)*uRes, sb = (b.xy*.5 + .5)*uRes, d = sb - sa; float L = length(d);
  vec2 n = L > 1e-4 ? vec2(-d.y, d.x)/L : vec2(0., 1.);
  vec2 p = mix(sa, sb, aCorner.x) + n*aCorner.y*1.1*uPx;
  gl_Position = vec4(p/uRes*2. - 1., 0., 1.);
  vS = iS + aCorner.x/31.; vDir = abs(normalize(iB - iA + 1e-6)); vSide = aCorner.y; vSeed = iSeed;
}`;
const LINE_FS = `#version 300 es
precision highp float;
in float vS; in vec3 vDir; in float vSide; in float vSeed;
uniform vec3 uPulse;           // two pulse positions along the tract (s), and their strength
uniform vec3 uMni;             // which way MNI x, y, z lie in view space, for the tract colours
out vec4 o;
void main(){
  float edge = 1. - smoothstep(.5, 1., abs(vSide));
  float jit = (fract(sin(vSeed*12.9898)*43758.5453) - .5)*.06;          // each streamline's pulse a touch early or late
  float h = exp(-pow((vS - uPulse.x - jit)/.035, 2.)) + exp(-pow((vS - uPulse.y + jit)/.035, 2.));
  vec3 col = .08 + .92*pow(vDir, vec3(.9));                               // tractography colours (in view axes, mapped below)
  col = vec3(col[int(uMni.x)], col[int(uMni.y)], col[int(uMni.z)]);
  float I = .42 + 2.2*h*uPulse.z;
  vec3 c = mix(col, vec3(1., .97, .92), clamp(h*uPulse.z*.6, 0., .7))*I*edge*.8;
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;
// the brain's outline: a faint shell, lit only at its rim
const SHELL_VS = `#version 300 es
in vec3 aPos; in vec3 aNrm;
uniform vec2 uRes; uniform vec3 uFit; uniform float uYaw;
out vec3 vN;
void main(){
  float c = cos(uYaw), s = sin(uYaw);
  vec3 p = aPos, n = aNrm;
  float xr = p.x*c + p.z*s, zr = -p.x*s + p.z*c, f = ${CAMERA}./(${CAMERA}. - zr);
  vec2 q = vec2(uFit.y + xr*uFit.x*f, uFit.z - p.y*uFit.x*f);
  gl_Position = vec4(q.x/uRes.x*2. - 1., 1. - q.y/uRes.y*2., -zr/400., 1.);
  vN = vec3(n.x*c + n.z*s, n.y, -n.x*s + n.z*c);
}`;
const SHELL_FS = `#version 300 es
precision highp float;
in vec3 vN; out vec4 o;
void main(){ vec3 n = normalize(vN); float rim = pow(1. - abs(n.z), 3.); vec3 c = vec3(.55, .6, .78)*rim*.32; o = vec4(c, max(c.r, max(c.g, c.b))); }`;

export function decodeFibres(json, buf, view) {
  const N = json.streamlines, P = json.points, V = VIEW[view], lo = json.lo, hi = json.hi;
  const q = new Uint16Array(buf, 0, N * P * 3), pt = k => [0, 1, 2].map(a => lo[a] + q[k * 3 + a] / 65535 * (hi[a] - lo[a]));
  const seg = new Float32Array(N * (P - 1) * 8), blo = [Infinity, Infinity, Infinity], bhi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < N; i++) for (let j = 0; j < P - 1; j++) {
    const a = V(pt(i * P + j)), b = V(pt(i * P + j + 1)), o = (i * (P - 1) + j) * 8;
    seg.set(a, o); seg.set(b, o + 3); seg[o + 6] = j / (P - 1); seg[o + 7] = i;
    for (let k = 0; k < 3; k++) { blo[k] = Math.min(blo[k], a[k]); bhi[k] = Math.max(bhi[k], a[k]); }
  }
  let shell = null;
  if (json.meshVerts) {
    const mv = json.meshVerts, mf = json.meshFaces, o = N * P * 6, mq = new Uint16Array(buf, o, mv * 4), mn = new Int8Array(buf, o + mv * 8, mv * 4);
    const pos = new Float32Array(mv * 3), nrm = new Float32Array(mv * 3);
    for (let i = 0; i < mv; i++) {
      const p = V([0, 1, 2].map(a => lo[a] + mq[i * 4 + a] / 65535 * (hi[a] - lo[a]))), n = V([mn[i * 4] / 127, mn[i * 4 + 1] / 127, mn[i * 4 + 2] / 127]);
      pos.set(p, i * 3); nrm.set(n, i * 3);
      for (let k = 0; k < 3; k++) { blo[k] = Math.min(blo[k], p[k]); bhi[k] = Math.max(bhi[k], p[k]); }
    }
    shell = { pos, nrm, index: new Uint32Array(buf, o + mv * 12, mf * 3) };
  }
  return { nseg: N * (P - 1), seg, shell, lo: blo, hi: bhi, view };
}

export function createFibres(canvas, data, { preserve = false, box = canvas, mode = 'writing' } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, LINE_VS, LINE_FS), sh = data.shell ? program(gl, SHELL_VS, SHELL_FS) : null;
  if (!pr || (data.shell && !sh)) return null;
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const cl = pr.a('aCorner'); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data.seg, gl.STATIC_DRAW);
  for (const [n, size, off] of [['iA', 3, 0], ['iB', 3, 3], ['iS', 1, 6], ['iSeed', 1, 7]]) { const l = pr.a(n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 32, off * 4); gl.vertexAttribDivisor(l, 1); }
  let svao = null, nidx = 0;
  if (sh) {
    svao = gl.createVertexArray(); gl.bindVertexArray(svao);
    for (const [n, arr] of [['aPos', data.shell.pos], ['aNrm', data.shell.nrm]]) { gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); const l = sh.a(n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.shell.index, gl.STATIC_DRAW); nidx = data.shell.index.length;
  }
  gl.bindVertexArray(null);
  // which MNI axis each view axis is, so a streamline running left-right is red however it is seen
  const MNI = { lateralLeft: [1, 2, 0], top: [0, 1, 2] }[data.view];
  const axisOf = [0, 0, 0]; MNI.forEach((m, viewAxis) => { axisOf[m] = viewAxis; });
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
      const time = fixed.age != null ? fixed.age : t, a = fixed.yaw != null ? fixed.yaw : 0.22 * Math.sin(2 * Math.PI * time / 36);
      const b = box.getBoundingClientRect(), lo = data.lo, hi = data.hi;
      const s = Math.min(0.86 * b.height * sc / (hi[1] - lo[1]), 0.9 * b.width * sc / (hi[0] - lo[0]));
      const fit = [s, (b.left + b.width / 2) * sc - (lo[0] + hi[0]) / 2 * s, (b.top + b.height / 2) * sc + (lo[1] + hi[1]) / 2 * s];
      let pulse;
      if (mode === 'writing') { const p = writingPulses(time); pulse = [p.fwd, p.back, 1]; }
      else { const c = crossing(time); pulse = [c.s, -5, c.amp]; }
      clear(); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      if (sh) {
        gl.useProgram(sh.p); gl.bindVertexArray(svao);
        gl.uniform2f(sh.u.uRes, canvas.width, canvas.height); gl.uniform3fv(sh.u.uFit, fit); gl.uniform1f(sh.u.uYaw, a);
        gl.drawElements(gl.TRIANGLES, nidx, gl.UNSIGNED_INT, 0);
      }
      gl.useProgram(pr.p); gl.bindVertexArray(vao);
      gl.uniform2f(pr.u.uRes, canvas.width, canvas.height); gl.uniform3fv(pr.u.uFit, fit); gl.uniform1f(pr.u.uYaw, a); gl.uniform1f(pr.u.uPx, sc);
      gl.uniform3fv(pr.u.uPulse, pulse); gl.uniform3f(pr.u.uMni, axisOf[0], axisOf[1], axisOf[2]);
      gl.blendEquation(gl.MAX); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, data.nseg); gl.blendEquation(gl.FUNC_ADD);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
  };
}
