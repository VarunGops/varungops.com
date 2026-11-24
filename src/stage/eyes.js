/* The eyes on Now. Each eye is a light source, and the light leaves it as fibres.
   The globes are the Human Reference Atlas eyes (from the Visible Human Male), drawn as dark glass: a rim of cool light
   round each sclera, the iris a ring of glowing spokes in the fibres' own colours, the pupil a white-hot core.
   From the centre of each pupil a sheaf of fibres leaves straight along the line of sight and opens into a wide canopy
   in three dimensions. The strands arc as they go, like fibre optics under their own weight, and the canopy sweeps
   slowly round the screen (scan.js). Each strand follows the sweep a little late, the tips later than the roots, so the
   canopy bends and flows instead of turning as one piece. The strands glow faintly along their length and brightly at
   their tips, and their colours turn slowly round the canopy, as a fibre-optic lamp's colour wheel does.
   Behind the words the fibres fade almost away, and they fade out as the eyes scroll off.
   Millimetres: +x the subject's left (the viewer's right), +y up, +z towards the viewer. */
import { program } from './gl.js';
import { scanAt } from './scan.js';

const CAMERA = 420, FOCUS = 600, NEAR = 20, FAR = 3000;   // mm: camera distance, where the eyes converge, clip planes
const K = 30;                                           // segments along each fibre
const NO_FIBRES = typeof location !== 'undefined' && new URLSearchParams(location.search).get('fibres') === '0';   // review switch: the eyes alone

// the camera, with the eyes' box placed wherever it sits on the screen: uScale is box over screen, uOff its centre
const CAM = `
uniform vec2 uTan, uScale, uOff, uOrbit;            // uOrbit: cos and sin of the camera's slow drift round the eyes
vec4 camera(vec3 p){
  p = vec3(uOrbit.x*p.x + uOrbit.y*p.z, p.y, -uOrbit.y*p.x + uOrbit.x*p.z);
  float w = ${CAMERA}. - p.z;
  return vec4(p.x/uTan.x*uScale.x + uOff.x*w, p.y/uTan.y*uScale.y + uOff.y*w, (w*(${FAR}.+${NEAR}.) - 2.*${FAR}.*${NEAR}.)/(${FAR}.-${NEAR}.), w);
}`;
// the fibre lamp's colour wheel: blue, cyan, violet, pink, green, yellow-green, and round again
const WHEEL = `
vec3 wheel(float x){
  x = fract(x)*6.;
  vec3 c[7] = vec3[7](vec3(.22,.42,1.), vec3(.25,.85,1.), vec3(.6,.32,1.), vec3(1.,.42,.85), vec3(.3,1.,.55), vec3(.72,1.,.3), vec3(.22,.42,1.));
  int i = int(floor(x)); return mix(c[i], c[i + 1], smoothstep(0., 1., fract(x)));
}`;
// one fibre: where it is at s in [0, 1]. Shared by the strands and their tips.
const FIBRE = `
uniform vec3 uPupil0, uPupil1, uGaze0, uGaze1; uniform float uTime, uLen, uCone, uLean; uniform int uPerEye;
float scanAngle(float t){ return 1.5707963 + .61*sin(6.2831853*t/60. + .3*sin(6.2831853*t/23.)); }   // as scan.js
vec3 canopy(vec3 g, float t, float lean){ float a = scanAngle(t); return normalize(g*.4 + vec3(cos(a) + lean, sin(a) + .3, .1)); }   // lean: towards the other eye, so the fans meet overhead
vec3 spread(vec3 A, vec4 seed, float cone){           // a direction in the cone round A, from the strand's seed
  vec3 t1 = normalize(cross(abs(A.z) < .9 ? vec3(0., 0., 1.) : vec3(1., 0., 0.), A)), t2 = cross(A, t1);
  float th = sqrt(seed.x)*cone, ph = seed.y*6.2831853;
  return normalize(A*cos(th) + (t1*cos(ph) + t2*sin(ph))*sin(th));
}
vec3 fibreAt(float s, vec4 seed, bool left, out vec3 colour){
  vec3 P = left ? uPupil0 : uPupil1, g = left ? uGaze0 : uGaze1;
  float lag = .5 + seed.z, lean = P.x > 0. ? -uLean : uLean;   // each strand follows the sweep a little late; the fans lean together (or apart on a phone)
  vec3 A0 = canopy(g, uTime - .35*lag, lean);
  vec3 dMid = spread(A0, seed, uCone*.38);                    // still close to the bundle half way out
  vec3 dTip = spread(canopy(g, uTime - .95*lag, lean), seed, uCone*1.55);   // then opening wide, like a fountain
  dTip = normalize(vec3(dTip.xy, min(dTip.z, .3)));         // none runs on towards the camera as a straight beam
  float L = uLen*(.55 + .45*seed.w), droop = .85 + .5*fract(seed.w*7.31);
  vec3 u1 = normalize(cross(vec3(0., 1., 0.), g)), u2 = cross(g, u1);
  float pr = sqrt(fract(seed.w*91.7))*1.4, pa = fract(seed.z*53.1)*6.2831853;
  P += (u1*cos(pa) + u2*sin(pa))*pr;                          // from anywhere on the pupil's small disc
  vec3 B1 = P + g*L*.07;                                      // first straight out, as one tight bundle
  vec3 B2 = P + dMid*L*.42 + vec3(0., L*.05, 0.);
  vec3 B3 = P + dTip*L - vec3(0., L*.42*droop, 0.);           // and falling away to the sides under its own weight
  float zmax = ${CAMERA - 70}.;                         // never reaching the camera
  if (B3.z > zmax) { float k = (zmax - P.z)/max(B3.z - P.z, 1e-3); B3 = P + (B3 - P)*k; B2 = P + (B2 - P)*min(1., k*1.1); }
  float r = 1. - s;
  colour = wheel(seed.y + uTime*.035 + (left ? 0. : .5));
  return r*r*r*P + 3.*r*r*s*B1 + 3.*r*s*s*B2 + s*s*s*B3;
}`;

const EYE_VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in float aCls; in float aSide;
uniform mat3 uR0, uR1; uniform vec3 uC0, uC1;
${CAM}
out vec3 vN; out vec3 vP; out vec3 vQ; out float vCls; out float vSide;
void main(){
  bool l = aSide < .5;
  vec3 c = l ? uC0 : uC1; mat3 R = l ? uR0 : uR1;
  vec3 p = c + R*(aPos - c);
  vN = R*aNrm; vP = p; vQ = aPos - c; vCls = aCls; vSide = aSide;
  gl_Position = camera(p);
}`;
const EYE_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vP; in vec3 vQ; in float vCls; in float vSide;
uniform float uPass, uTime;
out vec4 o;
${WHEEL}
float lines(float coord, float thick){ float f = abs(fract(coord) - .5)*2., w = fwidth(coord)*1.4; return 1. - smoothstep(thick - w, thick + w, f); }
void main(){
  int c = int(vCls + .5);
  if (uPass < .5) { if (c == 0 || c == 2 || c == 3) { o = vec4(0., 0., 0., 1.); return; } discard; }
  if (c > 3) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vec3(-vP.x, -vP.y, ${CAMERA}. - vP.z)), l = normalize(vec3(-.45, .6, .66));
  float ndl = clamp(dot(n, l), 0., 1.), rim = pow(1. - clamp(dot(n, v), 0., 1.), 2.6);
  float phi = acos(clamp(normalize(vQ).z, -1., 1.)), alpha = atan(vQ.y, vQ.x), r = length(vQ.xy);
  vec3 g;
  if (c == 0) {                                   // sclera: dark glass, a cool rim, the faintest rings of latitude
    g = vec3(.42, .52, .95)*rim*.55 + vec3(.5, .55, .75)*ndl*.06;
  } else if (c == 2) {                            // iris: spokes of light in the fibres' colours, brightest at the pupil
    float fib = .5 + .5*sin(alpha*120. + sin(alpha*17.)*3.), limbus = exp(-pow(r - 5.4, 2.)*3.);
    g = mix(vec3(.7, .85, 1.), wheel(alpha/6.2831853 + uTime*.035 + (vSide > .5 ? .5 : 0.)), .5)*(fib*.22 + .06)*(.5 + .5*exp(-(r - 1.7)*.5)) + vec3(.55, .7, 1.)*limbus*.32;
  } else if (c == 3) {                            // the pupil: white-hot
    g = mix(vec3(.95, .6, 1.), vec3(1.), smoothstep(1.4, .3, r))*.75;
  } else {                                        // the cornea: clear, a glint
    float spec = pow(clamp(dot(reflect(-l, n), v), 0., 1.), 80.);
    g = vec3(.8, .95, 1.)*(spec*1.4 + rim*.12);
  }
  o = vec4(g, max(g.r, max(g.g, g.b)));
}`;

const STRAND_VS = `#version 300 es
in vec2 aCorner;                                      // x: s along the fibre; y: -1 or 1 across it
in vec4 aSeed;
${CAM}
${WHEEL}
${FIBRE}
uniform vec2 uRes; uniform float uWidth;
out float vS; out float vAcross; out vec3 vCol; out float vBright; out float vPx;   // vPx: pixels from its pupil, on screen
void main(){
  bool left = gl_InstanceID < uPerEye;
  vec3 col, cdummy;
  float s = aCorner.x, e = .5/${K}.;
  vec4 a = camera(fibreAt(s, aSeed, left, col)), b = camera(fibreAt(min(1., s + e), aSeed, left, cdummy)), z = camera(fibreAt(max(0., s - e), aSeed, left, cdummy));
  vec2 sa = a.xy/a.w*uRes, sb = b.xy/b.w*uRes, sz = z.xy/z.w*uRes, t = normalize(sb - sz + 1e-5), nrm = vec2(-t.y, t.x);
  float near = clamp(260./a.w, .6, 4.);                // nearer the camera: wider, and fainter for it
  float fog = clamp(1.25 - (a.w - 330.)/520., .3, 1.);   // farther: dimmer
  vec2 pos = sa + nrm*aCorner.y*uWidth*(.7 + near);
  gl_Position = vec4(pos/uRes*a.w, a.z, a.w);
  vec3 cd; vec4 p0 = camera(fibreAt(0., aSeed, left, cd));
  vPx = length(pos - p0.xy/p0.w*uRes);
  vS = s; vAcross = aCorner.y; vCol = col; vBright = (.35 + .65*fract(aSeed.w*13.7))/sqrt(near)*fog;
}`;
const GLOW_FS = `
uniform float uGain, uFade; uniform vec4 uText, uNav;   // the words' box and the link home's, in window pixels from the bottom left
float box(vec4 r, float round, float soft){             // 0 inside the box, rising to 1 well clear of it
  vec2 c = (r.xy + r.zw)*.5, h = (r.zw - r.xy)*.5, q = abs(gl_FragCoord.xy - c) - h + round;
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - round;
  return smoothstep(-soft*.25, soft, d);
}
float clearOfWords(){ return box(uText, 90., 240.)*box(uNav, 20., 70.); }   // a soft, rounded fade, so no words sit in a hard dark box`;
const STRAND_FS = `#version 300 es
precision highp float;
in float vS; in float vAcross; in vec3 vCol; in float vBright; in float vPx;
uniform float uEyePx;
${GLOW_FS}
out vec4 o;
void main(){
  float across = exp(-vAcross*vAcross*5.)*.8 + exp(-vAcross*vAcross*1.3)*.2;      // a bright core in a soft halo
  float along = .11 + .16*exp(-vS*10.) + .9*smoothstep(.8, 1., vS);              // faint along the shaft, glowing towards the tip
  vec3 tint = mix(vec3(dot(vCol, vec3(.33))), vCol, .72);                              // the wheel's colours, softened
  vec3 col = mix(vec3(.8, .9, 1.), tint, .45 + .45*smoothstep(.3, .95, vS));            // pale near the eye, its colour as it opens
  float emerge = mix(.05, 1., smoothstep(uEyePx*.3, uEyePx*1.6, vPx))*mix(.4, 1., smoothstep(uEyePx*1.2, uEyePx*3.5, vPx));   // faint over the eye, and softer where the bundle leaves it
  vec3 g = col*across*along*vBright*uGain*clearOfWords()*uFade*emerge;
  o = vec4(g, max(g.r, max(g.g, g.b)));
}`;

const TIP_VS = `#version 300 es
in vec4 aSeed;
${CAM}
${WHEEL}
${FIBRE}
uniform float uPx;
out vec3 vCol; out float vTw;
void main(){
  bool left = gl_InstanceID < uPerEye;
  vec3 col; vec4 c = camera(fibreAt(1., aSeed, left, col));
  gl_Position = (gl_InstanceID % 2 == 1) ? vec4(2., 2., 2., 1.) : c;      // every other strand ends unlit, so the tips read as ends, not a starfield
  float tw = .55 + .45*sin(uTime*(1.3 + 2.*aSeed.z) + aSeed.w*40.);             // each tip twinkles at its own pace
  gl_PointSize = uPx*(2.4 + 3.2*clamp(260./c.w, .6, 4.))*(.6 + .4*tw);
  vCol = col; vTw = tw;
}`;
const TIP_FS = `#version 300 es
precision highp float;
in vec3 vCol; in float vTw;
${GLOW_FS}
out vec4 o;
void main(){
  vec2 q = gl_PointCoord*2. - 1.; float r2 = dot(q, q); if (r2 > 1.) discard;
  vec3 g = mix(vCol, vec3(1.), .15)*(exp(-r2*5.) + .35*exp(-r2*1.2))*vTw*uGain*3.2*clearOfWords()*uFade;
  o = vec4(g, max(g.r, max(g.g, g.b)));
}`;

// a soft bloom of light round each pupil, drawn as a screen-facing quad
const HALO_VS = `#version 300 es
in vec2 aCorner;
${CAM}
uniform vec3 uPupil0, uPupil1; uniform vec2 uRes; uniform float uSize;
out vec2 vQ;
void main(){
  vec4 c = camera(gl_InstanceID == 0 ? uPupil0 : uPupil1);
  vQ = aCorner;
  gl_Position = vec4((c.xy/c.w*uRes + aCorner*uSize)/uRes*c.w, 0., c.w);
}`;
const HALO_FS = `#version 300 es
precision highp float;
in vec2 vQ;
uniform float uFade;
out vec4 o;
void main(){
  float r2 = dot(vQ, vQ);
  vec3 g = (vec3(1., .92, 1.)*exp(-r2*90.)*.5 + vec3(.7, .55, 1.)*exp(-r2*14.)*.08)*uFade;
  o = vec4(g, max(g.r, max(g.g, g.b)));
}`;

const seeded = s => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the turn that brings +z onto direction d: yaw about y, then pitch (column-major)
function aim(d) {
  const yaw = Math.atan2(d[0], d[2]), pitch = Math.asin(Math.max(-1, Math.min(1, d[1])));
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [cy, 0, -sy, -sy * sp, cp, -cy * sp, sy * cp, sp, cy * cp];
}

export function createEyes(canvas, mesh, json, { preserve = false, lite = false, box = canvas } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const eye = program(gl, EYE_VS, EYE_FS), strand = program(gl, STRAND_VS, STRAND_FS), tip = program(gl, TIP_VS, TIP_FS), halo = program(gl, HALO_VS, HALO_FS);
  if (!eye || !strand || !tip || !halo) return null;

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (name, data, size, type, norm) => { const loc = eye.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr('aPos', mesh.pos, 3, gl.FLOAT, false); attr('aNrm', mesh.nrm, 3, gl.BYTE, true);
  attr('aCls', mesh.cls, 1, gl.UNSIGNED_BYTE, false); attr('aSide', mesh.side, 1, gl.UNSIGNED_BYTE, false);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

  const perEye = lite ? 900 : 2400, rnd = seeded(29), seeds = new Float32Array(perEye * 2 * 4);
  // strands bunch into tufts, as real fibres do: each tuft a spot in the cone, its strands scattered close round it
  const tufts = Array.from({ length: 2 * (lite ? 26 : 48) }, () => [rnd(), rnd(), rnd()]);
  for (let i = 0; i < perEye * 2; i++) {
    const eyeOf = i < perEye ? 0 : 1, t = tufts[eyeOf * (tufts.length / 2) + Math.floor(rnd() * tufts.length / 2)], loose = rnd() < 0.25;
    const jit = loose ? 0.5 : 0.07;               // a quarter of the strands stray from their tuft
    seeds.set([Math.min(0.999, Math.max(0, t[0] + (rnd() - 0.5) * jit)), t[1] + (rnd() - 0.5) * jit * 0.35, Math.min(0.999, Math.max(0, t[2] + (rnd() - 0.5) * 0.25)), rnd()], i * 4);
  }
  const seedBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  const strip = new Float32Array((K + 1) * 4);
  for (let i = 0; i <= K; i++) strip.set([i / K, -1, i / K, 1], i * 4);
  const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const vaoWith = (pr, corners) => {                    // a VAO with an optional per-vertex corner buffer and the per-strand seeds
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    const cl = pr.a('aCorner'); if (corners && cl >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0); }
    const sl = pr.a('aSeed'); if (sl >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf); gl.enableVertexAttribArray(sl); gl.vertexAttribPointer(sl, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(sl, 1); }
    gl.bindVertexArray(null); return v;
  };
  const svao = vaoWith(strand, strip), tvao = vaoWith(tip, null), hvao = vaoWith(halo, quad);

  const C = json.centre, R = json.radius, words = document.querySelector('.side-body'), nav = document.querySelector('.side-top .home-link');
  let vw = 0, vh = 0, s = 1, tanX = 1, tanY = 1;

  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = r.width; vh = r.height; s = Math.min(dpr, Math.sqrt(7e6 / Math.max(1, vw * vh)));
      const W = Math.max(2, Math.round(vw * s)), H = Math.max(2, Math.round(vh * s));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const b = box.getBoundingClientRect(), span = (Math.abs(C[0][0] - C[1][0]) + 2 * R[0] + 6) / 2;
      tanX = span / (lite || b.width < 700 ? 0.68 : 0.6) / CAMERA; tanY = tanX * b.height / Math.max(1, b.width);
      if (tanY * CAMERA < R[0] * 1.8) { tanY = R[0] * 1.8 / CAMERA; tanX = tanY * b.width / Math.max(1, b.height); }
    },
    clear() { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
    // fixed.age freezes the moment (review, reduced motion)
    draw(t, fixed = {}) {
      const time = fixed.age != null ? fixed.age : t, { dir: F } = scanAt(time);
      const b = box.getBoundingClientRect(), W = canvas.width, H = canvas.height;
      const scale = [b.width / vw, b.height / vh], off = [(b.left + b.width / 2) / vw * 2 - 1, 1 - (b.top + b.height / 2) / vh * 2];
      // the eyes look out along their fibres
      const T = [FOCUS * Math.tan(0.36 * F[0]), FOCUS * Math.tan(0.26 * F[1]), FOCUS];
      const gaze = C.map(c => { const d = [T[0] - c[0], T[1] - c[1], T[2] - c[2]], n = Math.hypot(...d); return d.map(v => v / n); });
      const rots = gaze.map(aim), pupils = C.map((c, i) => c.map((v, k) => v + gaze[i][k] * (R[i] + 1.2)));
      const none = { left: 0, right: 0, top: 0, bottom: 0 }, wr = words ? words.getBoundingClientRect() : none, nr = nav ? nav.getBoundingClientRect() : none;
      const fade = Math.max(0, Math.min(1, (b.bottom + 0.1 * vh) / (0.5 * vh)));          // fading as the eyes scroll off
      const eyePx = R[0] * (b.width * s / 2) / (tanX * CAMERA);                           // a globe's radius on screen, device pixels
      const orbit = 0.11 * Math.sin(Math.PI * 2 * time / 31);
      const cam = pr => { gl.uniform2f(pr.u.uTan, tanX, tanY); gl.uniform2fv(pr.u.uScale, scale); gl.uniform2fv(pr.u.uOff, off); gl.uniform2f(pr.u.uOrbit, Math.cos(orbit), Math.sin(orbit)); };
      const fibreUniforms = pr => {
        const u = pr.u; cam(pr);
        gl.uniform3fv(u.uPupil0, pupils[0]); gl.uniform3fv(u.uPupil1, pupils[1]); gl.uniform3fv(u.uGaze0, gaze[0]); gl.uniform3fv(u.uGaze1, gaze[1]);
        gl.uniform1f(u.uTime, time); gl.uniform1f(u.uLen, lite ? 360 : 430); gl.uniform1f(u.uCone, 0.88); gl.uniform1f(u.uLean, lite || b.width < 700 ? -0.3 : 0.35); gl.uniform1i(u.uPerEye, perEye);
        gl.uniform1f(u.uGain, lite ? 0.55 : 0.36); gl.uniform1f(u.uFade, fade);
        gl.uniform4f(u.uText, wr.left * s, (vh - wr.bottom) * s, wr.right * s, (vh - wr.top) * s);
        gl.uniform4f(u.uNav, nr.left * s, (vh - nr.bottom) * s, nr.right * s, (vh - nr.top) * s);
      };

      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // the eyes: solid for depth, then their light
      gl.useProgram(eye.p); cam(eye); gl.bindVertexArray(vao);
      gl.uniformMatrix3fv(eye.u.uR0, false, rots[0]); gl.uniformMatrix3fv(eye.u.uR1, false, rots[1]); gl.uniform3fv(eye.u.uC0, C[0]); gl.uniform3fv(eye.u.uC1, C[1]);
      gl.uniform1f(eye.u.uTime, time);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
      gl.uniform1f(eye.u.uPass, 0); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.uniform1f(eye.u.uPass, 1); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);

      // the fibres, in front of the eyes and hidden where they pass behind one
      if (!NO_FIBRES) {
      gl.useProgram(strand.p); fibreUniforms(strand); gl.bindVertexArray(svao);
      gl.uniform2f(strand.u.uRes, W / 2, H / 2); gl.uniform1f(strand.u.uWidth, Math.max(0.9, 1.1 * s)); gl.uniform1f(strand.u.uEyePx, eyePx);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (K + 1) * 2, perEye * 2);
      gl.useProgram(tip.p); fibreUniforms(tip); gl.bindVertexArray(tvao); gl.uniform1f(tip.u.uPx, s);
      gl.drawArraysInstanced(gl.POINTS, 0, 1, perEye * 2);
      }

      // and the bloom of light at each pupil
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(halo.p); cam(halo); gl.bindVertexArray(hvao);
      gl.uniform3fv(halo.u.uPupil0, pupils[0]); gl.uniform3fv(halo.u.uPupil1, pupils[1]); gl.uniform2f(halo.u.uRes, W / 2, H / 2);
      gl.uniform1f(halo.u.uSize, (R[0] * 2.6) * (b.width * s / 2) / (tanX * CAMERA)); gl.uniform1f(halo.u.uFade, 0.75 + 0.25 * fade);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 2);
      gl.bindVertexArray(null); gl.depthMask(true);
    },
  };
}
