/* The eyes on Now: the Human Reference Atlas eyes (from the Visible Human Male), drawn not as a photograph but as an
   engraving in colour: rings of latitude round each globe, spokes and rings across each iris, a glowing pupil. The
   geometry is the scan's own; only the drawing is abstract.
   From each pupil a bundle of fibres leaves as one tight sheaf, arches out, and opens into a broad band of parallel
   strands that runs on across the whole screen. The two bands move together and sweep slowly round the screen
   (scan.js); the eyes look where their fibres go. Behind the words the fibres fade almost away, and they fade out as
   the eyes scroll off.
   Millimetres for the eyes (+x the subject's left, the viewer's right; +y up; +z towards the viewer); screen pixels for
   the fibres. */
import { program } from './gl.js';
import { scanAt } from './scan.js';

const CAMERA = 420, FOCUS = 600, NEAR = 20, FAR = 2000;   // mm: camera distance, where the eyes converge, clip planes
const K = 36;                                           // segments along each fibre

// the camera, with the eyes' box placed wherever it sits on the screen: uScale is box over screen, uOff its centre
const CAM = `
uniform vec2 uTan, uScale, uOff;
vec4 camera(vec3 p){
  float w = ${CAMERA}. - p.z;
  return vec4(p.x/uTan.x*uScale.x + uOff.x*w, p.y/uTan.y*uScale.y + uOff.y*w, ((${CAMERA}. - p.z)*(${FAR}.+${NEAR}.) - 2.*${FAR}.*${NEAR}.)/(${FAR}.-${NEAR}.), w);
}`;

const EYE_VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in float aCls; in float aSide;
uniform mat3 uR0, uR1; uniform vec3 uC0, uC1;
${CAM}
out vec3 vN; out vec3 vP; out vec3 vQ; out float vCls;
void main(){
  bool l = aSide < .5;
  vec3 c = l ? uC0 : uC1; mat3 R = l ? uR0 : uR1;
  vec3 p = c + R*(aPos - c);
  vN = R*aNrm; vP = p; vQ = aPos - c; vCls = aCls;     // vQ: the point in the eye's own frame, so the pattern turns with it
  gl_Position = camera(p);
}`;
// pass 0: sclera, iris and pupil solid black, so what is behind them is hidden; pass 1: the line work, as light
const EYE_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vP; in vec3 vQ; in float vCls;
uniform float uPass;
out vec4 o;
float lines(float coord, float thick){ float f = abs(fract(coord) - .5)*2., w = fwidth(coord)*1.4; return 1. - smoothstep(thick - w, thick + w, f); }
void main(){
  int c = int(vCls + .5);
  if (uPass < .5) { if (c == 0 || c == 2 || c == 3) { o = vec4(0., 0., 0., 1.); return; } discard; }
  if (c > 3) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vec3(-vP.x, -vP.y, ${CAMERA}. - vP.z));
  float ndl = clamp(dot(n, normalize(vec3(-.45, .6, .66))), 0., 1.), rim = pow(1. - clamp(dot(n, v), 0., 1.), 2.2);
  float phi = acos(clamp(normalize(vQ).z, -1., 1.)), alpha = atan(vQ.y, vQ.x), r = length(vQ.xy);
  vec3 col; float I;
  if (c == 0) {                                   // sclera: rings of latitude, a few meridians, in shifting violet and cyan
    float ring = lines(phi*15., mix(.06, .42, ndl)), mer = lines(alpha*18./6.2832, .05)*smoothstep(.5, 1.4, phi);
    col = mix(vec3(.55, .35, 1.), vec3(.3, .9, 1.), .5 + .5*sin(phi*3.1 + alpha));
    I = max(ring, mer*.5)*(.3 + .7*ndl) + rim*.55;
  } else if (c == 2) {                            // iris: spokes and rings, gold at the pupil to teal at the rim
    float spoke = lines(alpha*72./6.2832, mix(.12, .4, ndl)), ring = lines(r*1.4, .08);
    col = mix(vec3(1., .78, .35), vec3(.15, .85, .8), smoothstep(1.8, 5., r));
    I = max(spoke, ring*.6)*(.45 + .55*ndl) + .12;
  } else if (c == 3) {                            // the pupil: dark, ringed with the fibres' pink-violet
    col = vec3(1., .45, .9); I = smoothstep(.9, 1.6, r)*.9;
  } else {                                        // the cornea: clear, a glint and a rim of light
    float spec = pow(clamp(dot(reflect(-normalize(vec3(-.45, .6, .66)), n), v), 0., 1.), 70.);
    col = vec3(.7, .95, 1.); I = spec*1.6 + rim*.25;
  }
  vec3 g = col*I;
  o = vec4(g, max(g.r, max(g.g, g.b)));
}`;

const FIBRE_VS = `#version 300 es
in vec2 aCorner;                     // x: 0 at the pupil to 1 at the far end; y: -1 or 1 across the strand
in vec4 aSeed;                       // across the band (-1..1); a second offset; brightness; phase
${CAM}
uniform vec3 uPupil0, uPupil1; uniform vec2 uFlow, uRes; uniform float uLen, uHalf, uWidth, uTime, uArch; uniform int uPerEye;
out vec2 vNdc; out float vS; out float vBright;
vec2 px(vec3 p){ vec4 c = camera(p); return c.xy/c.w*uRes*.5; }
vec2 bez(vec2 a, vec2 b, vec2 c, vec2 d, float s){ float t = 1. - s; return t*t*t*a + 3.*t*t*s*b + 3.*t*s*s*c + s*s*s*d; }
void main(){
  bool left = gl_InstanceID < uPerEye;
  float side = left ? -1. : 1.;
  vec2 P0 = px(left ? uPupil0 : uPupil1), F = uFlow, N = vec2(-F.y, F.x);
  vec2 S = normalize(F*cos(uArch) - N*side*sin(uArch));            // each sheaf first arches out to its own side
  float off = aSeed.x, shift = -side*uHalf*.6;                     // the two bands run side by side
  vec2 A = P0 + S*uLen*.12 + N*aSeed.y*uHalf*.04;
  vec2 B = P0 + F*uLen*.24 + N*(off*uHalf*.9 + shift*.85);
  vec2 C = P0 + F*uLen + N*(off*uHalf*1.5 + shift);
  float s = aCorner.x, e = .004;
  float wave = sin(s*6.5 - uTime*.8 + aSeed.w*6.2832)*uHalf*.045;   // a slow ripple travelling out along the band
  vec2 p = bez(P0, A, B, C, s) + N*wave*s*s, q = bez(P0, A, B, C, min(1., s + e)) + N*sin((s + e)*6.5 - uTime*.8 + aSeed.w*6.2832)*uHalf*.045*(s + e)*(s + e);
  vec2 t = normalize(q - p + 1e-5), nrm = vec2(-t.y, t.x);
  vec2 pos = p + nrm*aCorner.y*uWidth;
  gl_Position = vec4(pos/(uRes*.5), 0., 1.);
  vNdc = pos/(uRes*.5); vS = s; vBright = aSeed.z;
}`;
const FIBRE_FS = `#version 300 es
precision highp float;
in vec2 vNdc; in float vS; in float vBright;
uniform float uGain, uFade; uniform vec4 uText;   // the words' box, in window pixels from the bottom left
out vec4 o;
vec3 ramp(float x){                                // across the screen: blue, cyan, violet, green, yellow-green
  x = clamp(x*.5 + .5, 0., 1.)*4.;
  vec3 c0 = vec3(.22,.45,1.), c1 = vec3(.25,.85,1.), c2 = vec3(.62,.36,1.), c3 = vec3(.3,1.,.55), c4 = vec3(.72,1.,.32);
  return x < 1. ? mix(c0, c1, x) : x < 2. ? mix(c1, c2, x - 1.) : x < 3. ? mix(c2, c3, x - 2.) : mix(c3, c4, x - 3.);
}
void main(){
  vec2 f = gl_FragCoord.xy;
  float d = max(max(uText.x - f.x, f.x - uText.z), max(uText.y - f.y, f.y - uText.w));   // < 0 inside the words' box
  float clear = mix(.1, 1., smoothstep(-20., 70., d));
  float k = (.25 + .75*vBright)*pow(1. - vS, .7)*clear*uFade;
  vec3 col = mix(ramp(vNdc.x), vec3(1., .5, .92), exp(-vS*14.))*k*uGain;
  o = vec4(col, max(col.r, max(col.g, col.b)));
}`;

const seeded = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the turn that brings +z onto direction d: yaw about y, then pitch (column-major)
function aim(d) {
  const yaw = Math.atan2(d[0], d[2]), pitch = Math.asin(Math.max(-1, Math.min(1, d[1])));
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [cy, 0, -sy, -sy * sp, cp, -cy * sp, sy * cp, sp, cy * cp];
}
const turn = (R, c, v) => [0, 1, 2].map(i => c[i] + R[i] * (v[0] - c[0]) + R[3 + i] * (v[1] - c[1]) + R[6 + i] * (v[2] - c[2]));

export function createEyes(canvas, mesh, json, { preserve = false, lite = false, box = canvas } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const eye = program(gl, EYE_VS, EYE_FS), fibre = program(gl, FIBRE_VS, FIBRE_FS);
  if (!eye || !fibre) return null;

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (name, data, size, type, norm) => { const loc = eye.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr('aPos', mesh.pos, 3, gl.FLOAT, false); attr('aNrm', mesh.nrm, 3, gl.BYTE, true);
  attr('aCls', mesh.cls, 1, gl.UNSIGNED_BYTE, false); attr('aSide', mesh.side, 1, gl.UNSIGNED_BYTE, false);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

  const perEye = lite ? 700 : 1600, rnd = seeded(29), seeds = new Float32Array(perEye * 2 * 4);
  for (let i = 0; i < perEye * 2; i++) seeds.set([rnd() * 2 - 1, rnd() * 2 - 1, rnd(), rnd()], i * 4);
  const strip = new Float32Array((K + 1) * 4);
  for (let i = 0; i <= K; i++) strip.set([i / K, -1, i / K, 1], i * 4);
  const fvao = gl.createVertexArray(); gl.bindVertexArray(fvao);
  const cl = fibre.a('aCorner'), sl = fibre.a('aSeed');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, strip, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(sl); gl.vertexAttribPointer(sl, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(sl, 1);
  gl.bindVertexArray(null);

  const C = json.centre, R = json.radius, words = document.querySelector('.side-body');
  let vw = 0, vh = 0, s = 1, tanX = 1, tanY = 1;

  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = r.width; vh = r.height; s = Math.min(dpr, Math.sqrt(7e6 / Math.max(1, vw * vh)));
      const W = Math.max(2, Math.round(vw * s)), H = Math.max(2, Math.round(vh * s));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const b = box.getBoundingClientRect(), span = (Math.abs(C[0][0] - C[1][0]) + 2 * R[0] + 6) / 2;
      tanX = span / (lite || b.width < 700 ? 0.62 : 0.46) / CAMERA; tanY = tanX * b.height / Math.max(1, b.width);
      if (tanY * CAMERA < R[0] * 1.6) { tanY = R[0] * 1.6 / CAMERA; tanX = tanY * b.width / Math.max(1, b.height); }
    },
    clear() { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
    // fixed.age freezes the moment (review, reduced motion)
    draw(t, fixed = {}) {
      const time = fixed.age != null ? fixed.age : t, { dir: F } = scanAt(time);
      const b = box.getBoundingClientRect();
      const scale = [b.width / vw, b.height / vh], off = [(b.left + b.width / 2) / vw * 2 - 1, 1 - (b.top + b.height / 2) / vh * 2];
      // the eyes look where their fibres go
      const T = [FOCUS * Math.tan(0.38 * F[0]), FOCUS * Math.tan(0.28 * F[1]), FOCUS];
      const rots = C.map(c => { const d = [T[0] - c[0], T[1] - c[1], T[2] - c[2]], n = Math.hypot(...d); return aim(d.map(v => v / n)); });
      const pupils = C.map((c, i) => turn(rots[i], c, [c[0], c[1], c[2] + R[i] + 1]));

      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const cam = pr => { gl.uniform2f(pr.u.uTan, tanX, tanY); gl.uniform2fv(pr.u.uScale, scale); gl.uniform2fv(pr.u.uOff, off); };

      gl.useProgram(fibre.p); cam(fibre); gl.bindVertexArray(fvao); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      const u = fibre.u, W = canvas.width, H = canvas.height, wr = words ? words.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
      gl.uniform3fv(u.uPupil0, pupils[0]); gl.uniform3fv(u.uPupil1, pupils[1]); gl.uniform2fv(u.uFlow, F); gl.uniform2f(u.uRes, W, H);
      gl.uniform1f(u.uLen, Math.hypot(W, H) * 0.95); gl.uniform1f(u.uHalf, Math.max(W, H) * 0.2); gl.uniform1f(u.uArch, 0.95);
      gl.uniform1f(u.uWidth, Math.min(1.2, 0.5 * s)); gl.uniform1f(u.uTime, time); gl.uniform1i(u.uPerEye, perEye);
      gl.uniform1f(u.uGain, lite ? 0.1 : 0.055);
      gl.uniform1f(u.uFade, Math.max(0, Math.min(1, (b.bottom + 0.1 * vh) / (0.5 * vh))));                       // fading as the eyes scroll off
      gl.uniform4f(u.uText, wr.left * s, (vh - wr.bottom) * s, wr.right * s, (vh - wr.top) * s);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (K + 1) * 2, perEye * 2);

      gl.useProgram(eye.p); cam(eye); gl.bindVertexArray(vao);
      gl.uniformMatrix3fv(eye.u.uR0, false, rots[0]); gl.uniformMatrix3fv(eye.u.uR1, false, rots[1]); gl.uniform3fv(eye.u.uC0, C[0]); gl.uniform3fv(eye.u.uC1, C[1]);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
      gl.uniform1f(eye.u.uPass, 0); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.uniform1f(eye.u.uPass, 1); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null); gl.depthMask(true);
    },
  };
}
