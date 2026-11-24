/* The eyes on Now: the Human Reference Atlas eyes (from the Visible Human Male), seen from the front, turning with a
   real gaze. Each globe turns about its own centre towards one point in front of the face, so the two converge as
   real eyes do. Thousands of fine strands of light leave each pupil along the line of sight and fan out across
   the screen, coloured by where they fall: blue to the left, violet in the middle, green to the right.
   Millimetres, +x the subject's left (the viewer's right), +y up, +z towards the viewer. */
import { program } from './gl.js';
import { gazeAt, aimAt, blendGaze } from './gaze.js';

const CAMERA = 420, FOCUS = 600, NEAR = 20, FAR = 2000;      // mm: camera distance, where the eyes converge, clip planes
const CONE = 0.5;                                          // half-angle of each fan of strands, radians

// shared by both programs: the perspective camera, and each eye turned about its own centre
const CAM = `
uniform vec2 uTan;                    // tangents of the half fields of view, x and y
uniform mat3 uR0, uR1; uniform vec3 uC0, uC1;
vec4 camera(vec3 p){ float zc = p.z - ${CAMERA}.; return vec4(p.x/uTan.x, p.y/uTan.y, (-zc*(${FAR}.+${NEAR}.) - 2.*${FAR}.*${NEAR}.)/(${FAR}.-${NEAR}.), -zc); }
vec3 turn(vec3 p, float side){ return side < .5 ? uC0 + uR0*(p - uC0) : uC1 + uR1*(p - uC1); }`;

const EYE_VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in float aCls; in float aSide;
${CAM}
out vec3 vN; out vec3 vP; out float vCls;
void main(){
  vec3 p = turn(aPos, aSide);
  vN = aSide < .5 ? uR0*aNrm : uR1*aNrm; vP = p; vCls = aCls;
  gl_Position = camera(p);
}`;
// the structures in atlas colours: sclera, cornea, iris, pupil, lens, ciliary body, retina, choroid
const EYE_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vP; in float vCls;
uniform float uPass;                  // 0: what lies inside, 1: the sclera as a translucent shell, 2: the cornea's glint
out vec4 o;
const vec3 COL[8] = vec3[8](vec3(.80,.86,1.), vec3(.55,.9,1.), vec3(.16,.72,.86), vec3(.02,.02,.04), vec3(1.,.74,.3), vec3(.62,.36,.95), vec3(1.,.42,.24), vec3(.75,.12,.22));
void main(){
  int c = int(vCls + .5);
  bool inner = c >= 2, shell = c == 0, glass = c == 1;
  if ((uPass < .5 && !inner) || (abs(uPass - 1.) < .5 && !shell) || (uPass > 1.5 && !glass)) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vec3(-vP.x, -vP.y, ${CAMERA}. - vP.z)), l = normalize(vec3(-.45, .6, .66));
  float ndl = clamp(dot(n, l), 0., 1.), rim = pow(1. - clamp(dot(n, v), 0., 1.), 2.5);
  float spec = pow(clamp(dot(reflect(-l, n), v), 0., 1.), 60.);
  vec3 col = COL[c];
  if (uPass < .5) { o = vec4(col*(.22 + .78*ndl) + col*rim*.6 + spec*.25, 1.); return; }
  if (uPass < 1.5) { float a = .82 + .18*rim; o = vec4(col*(.25 + .75*ndl)*a + vec3(spec*.4), a); return; }
  vec3 g = col*rim*.55 + vec3(spec*1.4);
  o = vec4(g, max(g.r, max(g.g, g.b)));                // light only: the cornea is clear
}`;

const STRAND_VS = `#version 300 es
in vec2 aCorner;                       // x: 0 at the pupil, 1 at the far end; y: -1 or 1 across the line
in vec4 aSeed;                         // u, v in the unit disc; brightness; phase
${CAM}
uniform vec3 uDir0, uDir1; uniform vec2 uRes; uniform float uWidth, uTime; uniform int uPerEye;
out float vSw; out float vW; out float vX; out float vBright; out float vPhase; out float vLen;   // vSw/vW: how far along the line, on screen
void main(){
  bool left = gl_InstanceID < uPerEye;
  vec3 g = left ? uDir0 : uDir1, c = left ? uC0 : uC1;
  vec3 t1 = normalize(cross(abs(g.y) < .95 ? vec3(0., 1., 0.) : vec3(1., 0., 0.), g)), t2 = cross(g, t1);
  vec3 d = normalize(g + (aSeed.x*t1 + aSeed.y*t2)*${Math.tan(CONE).toFixed(4)});
  vec3 p0 = c + g*12.6;                                         // just in front of the cornea
  float len = min(900., (${CAMERA - 70}. - p0.z)/max(d.z, .2));  // run on until just short of the camera
  vec4 a = camera(p0), b = camera(p0 + d*len);
  vec2 sa = a.xy/a.w*uRes, sb = b.xy/b.w*uRes, along = normalize(sb - sa + 1e-6), across = vec2(-along.y, along.x);
  vec4 e = mix(a, b, aCorner.x);
  vec2 s = e.xy/e.w*uRes + across*aCorner.y*uWidth;
  gl_Position = vec4(s/uRes*e.w, e.z, e.w);
  vSw = aCorner.x*e.w; vW = e.w; vX = e.x/e.w; vLen = length(sb - sa); vBright = aSeed.z; vPhase = aSeed.w;
}`;
const STRAND_FS = `#version 300 es
precision highp float;
in float vSw; in float vW; in float vX; in float vBright; in float vPhase; in float vLen;
uniform float uTime, uGain, uReach, uEyePx;
out vec4 o;
vec3 ramp(float x){                    // across the screen: blue, cyan, violet, green, yellow-green
  x = clamp(x*.5 + .5, 0., 1.)*4.;
  vec3 c0 = vec3(.22,.45,1.), c1 = vec3(.25,.85,1.), c2 = vec3(.62,.36,1.), c3 = vec3(.3,1.,.55), c4 = vec3(.72,1.,.32);
  return x < 1. ? mix(c0, c1, x) : x < 2. ? mix(c1, c2, x - 1.) : x < 3. ? mix(c2, c3, x - 2.) : mix(c3, c4, x - 3.);
}
void main(){
  float px = vSw/vW*vLen;                                                      // pixels from the pupil
  float fade = (.08 + .92*smoothstep(uEyePx*.35, uEyePx*1.15, px))*exp(-px/uReach)*(.3 + .7*vBright);   // faint over the iris, full beyond the eye, then thinning out
  float shimmer = .75 + .25*sin(px*.05 - uTime*2.2 + vPhase*6.283);            // light moving out along the fibre
  vec3 col = mix(ramp(vX), vec3(1., .45, .9), exp(-px/40.));                   // pink-violet where it leaves the eye
  vec3 c = col*fade*shimmer*uGain;
  o = vec4(c, max(c.r, max(c.g, c.b)));      // a real opacity: the page composites the canvas as premultiplied colour
}`;

const seeded = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the turn that brings +z onto direction d: yaw about y, then pitch
function aim(d) {
  const yaw = Math.atan2(d[0], d[2]), pitch = Math.asin(Math.max(-1, Math.min(1, d[1])));
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [cy, 0, -sy, -sy * sp, cp, -cy * sp, sy * cp, sp, cy * cp];         // column-major Ry(yaw)·Rx(-pitch)
}

export function createEyes(canvas, mesh, json, { preserve = false, lite = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const eye = program(gl, EYE_VS, EYE_FS), strand = program(gl, STRAND_VS, STRAND_FS);
  if (!eye || !strand) return null;

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (pr, name, data, size, type, norm) => { const loc = pr.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr(eye, 'aPos', mesh.pos, 3, gl.FLOAT, false); attr(eye, 'aNrm', mesh.nrm, 3, gl.BYTE, true);
  attr(eye, 'aCls', mesh.cls, 1, gl.UNSIGNED_BYTE, false); attr(eye, 'aSide', mesh.side, 1, gl.UNSIGNED_BYTE, false);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

  const perEye = lite ? 2500 : 6000, rnd = seeded(29), seeds = new Float32Array(perEye * 2 * 4);
  for (let i = 0; i < perEye * 2; i++) {          // denser towards the middle of each fan, as fibres bunch at the eye
    const r = Math.pow(rnd(), 0.75), th = rnd() * Math.PI * 2;
    seeds.set([r * Math.cos(th), r * Math.sin(th), rnd(), rnd()], i * 4);
  }
  const svao = gl.createVertexArray(); gl.bindVertexArray(svao);
  const cl = strand.a('aCorner'), sl = strand.a('aSeed');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(sl); gl.vertexAttribPointer(sl, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(sl, 1);
  gl.bindVertexArray(null);

  const C = json.centre, R = json.radius;
  let w = 0, h = 0, tanX = 1, tanY = 1, rect = null, pointer = null, movedAt = -1e9;
  const onMove = e => { pointer = [e.clientX, e.clientY]; movedAt = performance.now() / 1000; };
  const onLeave = () => { pointer = null; };
  addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave); addEventListener('blur', onLeave);

  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const s = Math.min(dpr, Math.sqrt(7e6 / Math.max(1, r.width * r.height)));
      w = r.width; h = r.height;
      const W = Math.max(2, Math.round(w * s)), H = Math.max(2, Math.round(h * s));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const span = (Math.abs(C[0][0] - C[1][0]) + 2 * R[0] + 6) / 2;           // half the width of both eyes, mm
      tanX = span / (lite || w < 700 ? 0.62 : 0.46) / CAMERA; tanY = tanX * h / w;
      if (tanY * CAMERA < R[0] * 1.6) { tanY = R[0] * 1.6 / CAMERA; tanX = tanY * w / h; }   // a very wide, short box: fit the height
    },
    // fixed.age freezes the moment (review, reduced motion); otherwise the gaze wanders, and follows a pointer
    draw(t, fixed = {}) {
      const time = fixed.age != null ? fixed.age : t;
      let g = gazeAt(time, 3);
      if (fixed.age == null && pointer) {
        rect = canvas.getBoundingClientRect();
        g = blendGaze(g, aimAt(pointer[0], pointer[1], rect, rect.top + rect.height / 2), performance.now() / 1000 - movedAt);
      }
      const T = [FOCUS * Math.tan(g.yaw), FOCUS * Math.tan(g.pitch), FOCUS];
      const dirs = C.map(c => { const d = [T[0] - c[0], T[1] - c[1], T[2] - c[2]], n = Math.hypot(...d); return d.map(v => v / n); });
      const rots = dirs.map(aim);

      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const shared = pr => { const u = pr.u; gl.uniform2f(u.uTan, tanX, tanY); gl.uniformMatrix3fv(u.uR0, false, rots[0]); gl.uniformMatrix3fv(u.uR1, false, rots[1]); gl.uniform3fv(u.uC0, C[0]); gl.uniform3fv(u.uC1, C[1]); };

      gl.useProgram(eye.p); shared(eye); gl.bindVertexArray(vao);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      gl.uniform1f(eye.u.uPass, 0); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.uniform1f(eye.u.uPass, 1); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform1f(eye.u.uPass, 2); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);
      gl.disable(gl.CULL_FACE);

      gl.useProgram(strand.p); shared(strand); gl.bindVertexArray(svao); gl.disable(gl.DEPTH_TEST);
      const u = strand.u, px = canvas.width / Math.max(1, w);
      gl.uniform3fv(u.uDir0, dirs[0]); gl.uniform3fv(u.uDir1, dirs[1]); gl.uniform2f(u.uRes, canvas.width / 2, canvas.height / 2);
      gl.uniform1f(u.uWidth, Math.min(1.5, 0.55 * px)); gl.uniform1f(u.uTime, time); gl.uniform1i(u.uPerEye, perEye); gl.uniform1f(u.uGain, lite ? 0.05 : 0.035); gl.uniform1f(u.uReach, canvas.width * 0.42);
      gl.uniform1f(u.uEyePx, R[0] * canvas.width / 2 / (tanX * CAMERA));            // the globe's radius in device pixels
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, perEye * 2);
      gl.bindVertexArray(null); gl.depthMask(true);
    },
  };
}
