/* The eyes on Now. Each eye is a light source, and what leaves it is a bonfire of sparks.
   The globes are the Human Reference Atlas eyes (from the Visible Human Male), drawn as dark glass: a rim of cool light
   round each sclera, the iris a ring of faint radial fibres with a limbal ring, the pupil glowing. Sparks are born at
   the centre of each pupil and leave along its gaze, then whirl across the whole screen on a curl-noise current
   (sparks.js, after Jaume Sánchez's Whirly Bonfire). The eyes sway their gaze slowly either side of upright (scan.js).
   Behind the words and the link home the sparks fade away, and they fade out as the eyes scroll off.
   Millimetres: +x the subject's left (the viewer's right), +y up, +z towards the viewer. */
import { program } from './gl.js';
import { scanAt } from './scan.js';
import { createSparks } from './sparks.js';

const CAMERA = 420, FOCUS = 600, NEAR = 20, FAR = 3000;   // mm: camera distance, where the eyes converge, clip planes
const NO_SPARKS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('sparks') === '0';   // review switch: the eyes alone
const STEP = 1 / 60;                                    // seconds per step of the bonfire, as in the original

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

const GLOW_FS = `
uniform float uGain, uFade; uniform vec4 uText, uNav;   // the words' box and the link home's, in window pixels from the bottom left
float box(vec4 r, float round, float soft){             // 0 inside the box, rising to 1 well clear of it
  vec2 c = (r.xy + r.zw)*.5, h = (r.zw - r.xy)*.5, q = abs(gl_FragCoord.xy - c) - h + round;
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - round;
  return smoothstep(-soft*.25, soft, d);
}
float clearOfWords(){ return mix(.22, 1., box(uText, 140., 320.))*box(uNav, 20., 70.); }   // the words keep a soft quarter-strength haze, never a hard edge   // a soft, rounded fade, so no words sit in a hard dark box`;
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

// the finish: the frame is drawn off screen, then laid onto the original's warm dark with grain and a vignette
const QUAD_VS = `#version 300 es
in vec2 aP; out vec2 vUv;
void main(){ vUv = aP*.5 + .5; gl_Position = vec4(aP, 0., 1.); }`;
const FINAL_FS = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uBase; uniform float uTime, uFade; out vec4 o;
float random(vec2 n, float offset){ return .5 - fract(sin(dot(n.xy + vec2(offset), vec2(12.9898, 78.233)))*43758.5453); }
void main(){
  vec4 b = texture(uBase, vUv);
  vec3 bg = vec3(.149, .106, .122)*uFade;                       // #261b1f, the original's warm dark
  vec3 c = bg*(1. - b.a) + b.rgb;
  c += vec3(.1*random(vUv, uTime))*uFade;                       // fine grain
  c *= mix(1., 1.1 - length(vUv - .5)*1.1, uFade);              // darker towards the corners
  c = max(c, 0.);
  o = vec4(c, max(uFade, max(c.r, max(c.g, c.b))));
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
  const eye = program(gl, EYE_VS, EYE_FS), halo = program(gl, HALO_VS, HALO_FS);
  if (!eye || !halo) return null;
  // the original moves 262,144 particles; here half that on a desktop, an eighth on a phone, fewer in frozen review frames
  const sparks = createSparks(gl, { count: preserve ? 8192 : lite ? 32768 : 131072, CAM, GLOW_FS });
  if (!sparks) return null;

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (name, data, size, type, norm) => { const loc = eye.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr('aPos', mesh.pos, 3, gl.FLOAT, false); attr('aNrm', mesh.nrm, 3, gl.BYTE, true);
  attr('aCls', mesh.cls, 1, gl.UNSIGNED_BYTE, false); attr('aSide', mesh.side, 1, gl.UNSIGNED_BYTE, false);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

  const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const final = program(gl, QUAD_VS, FINAL_FS);
  if (!final) return null;
  const qvao = gl.createVertexArray(); gl.bindVertexArray(qvao);
  { gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); const l = final.a('aP'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }
  // targets: the full frame (with depth) and two quarter-size buffers for the blur; remade when the size changes
  const tex = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  const fbo = (t, depth) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); if (depth) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return f; };
  let post = null;
  const makePost = (W, H) => {
    if (post) { for (const t of post.tex) gl.deleteTexture(t); for (const f of post.fb) gl.deleteFramebuffer(f); gl.deleteRenderbuffer(post.depth); }
    const qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2), depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
    const t = [tex(W, H), tex(qw, qh), tex(qw, qh)];
    post = { W, H, qw, qh, depth, tex: t, fb: [fbo(t[0], depth), fbo(t[1]), fbo(t[2])] };
  };
  const pass = (pr, target, w, h, setup) => { gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, w, h); gl.useProgram(pr.p); setup(pr.u); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  const bindTex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };

  const hvao = gl.createVertexArray(); gl.bindVertexArray(hvao);
  { const cl = halo.a('aCorner'); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0); }
  gl.bindVertexArray(null);

  const C = json.centre, R = json.radius, words = document.querySelector('.side-body'), nav = document.querySelector('.side-top .home-link');
  let vw = 0, vh = 0, s = 1, tanX = 1, tanY = 1, simT = null;
  // where the eyes look at time t: out along the sway, both turning towards one point, so they converge
  const eyesAt = t => {
    const { dir: F } = scanAt(t), T = [FOCUS * Math.tan(0.36 * F[0]), FOCUS * Math.tan(0.26 * F[1]), FOCUS];
    const gaze = C.map(c => { const d = [T[0] - c[0], T[1] - c[1], T[2] - c[2]], n = Math.hypot(...d); return d.map(v => v / n); });
    return { gaze, rots: gaze.map(aim), pupils: C.map((c, i) => c.map((v, k) => v + gaze[i][k] * (R[i] + 1.2))) };
  };

  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = r.width; vh = r.height; s = Math.min(dpr, Math.sqrt(7e6 / Math.max(1, vw * vh)));
      const W = Math.max(2, Math.round(vw * s)), H = Math.max(2, Math.round(vh * s));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      if (!post || post.W !== W || post.H !== H) makePost(W, H);
      const b = box.getBoundingClientRect(), span = (Math.abs(C[0][0] - C[1][0]) + 2 * R[0] + 6) / 2;
      tanX = span / (lite || b.width < 700 ? 0.68 : 0.6) / CAMERA; tanY = tanX * b.height / Math.max(1, b.width);
      if (tanY * CAMERA < R[0] * 1.8) { tanY = R[0] * 1.8 / CAMERA; tanX = tanY * b.width / Math.max(1, b.height); }
    },
    clear() { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
    // fixed.age freezes the moment (review, reduced motion)
    draw(t, fixed = {}) {
      const time = fixed.age != null ? fixed.age : t;
      const b = box.getBoundingClientRect(), W = canvas.width, H = canvas.height;
      const scale = [b.width / vw, b.height / vh], off = [(b.left + b.width / 2) / vw * 2 - 1, 1 - (b.top + b.height / 2) / vh * 2];
      const { gaze, rots, pupils } = eyesAt(time);
      const none = { left: 0, right: 0, top: 0, bottom: 0 }, wr = words ? words.getBoundingClientRect() : none, nr = nav ? nav.getBoundingClientRect() : none;
      const fade = Math.max(0, Math.min(1, (b.bottom + 0.1 * vh) / (0.5 * vh)));          // fading as the eyes scroll off
      const orbit = 0.11 * Math.sin(Math.PI * 2 * time / 31);
      const cam = pr => { gl.uniform2f(pr.u.uTan, tanX, tanY); gl.uniform2fv(pr.u.uScale, scale); gl.uniform2fv(pr.u.uOff, off); gl.uniform2f(pr.u.uOrbit, Math.cos(orbit), Math.sin(orbit)); };
      // the sparks: a fixed step, however the frames come; a frozen moment (review, reduced motion) is reached by
      // running the last five seconds before it, so it is the same every time
      if (!NO_SPARKS) {
        const run = (from, to, most = Infinity) => { let k = from, n = 0; while (k + STEP <= to + 1e-9 && n++ < most) { k += STEP; sparks.step(k, { pupils: eyesAt(k).pupils, zmax: CAMERA - 25, speed: 0.55, freq: 0.0045, spawn: 7 }); } return k; };
        if (fixed.age != null) { if (simT !== time) { sparks.reset(); run(time - 1.5, time); simT = time; } }   // a frozen frame: the same second and a half before it, every time
        else {
          if (simT == null) simT = run(time - 2, time);                // the first look already has the fire going
          else if (time - simT > 0.2) simT = time - STEP;              // after a pause, carry on rather than catch up
          simT = run(simT, time, 4);                                   // at most four steps a frame, as in the original
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.fb[0]);                                     // the frame is drawn off screen first
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

      // the sparks, in front of the eyes and hidden where they pass behind one
      if (!NO_SPARKS) {
        const sp = { u: sparks.uniforms };
        gl.useProgram(sparks.program); cam(sp);
        gl.uniform1f(sp.u.uGain, lite ? 0.5 : 0.6); gl.uniform1f(sp.u.uFade, fade);
        gl.uniform4f(sp.u.uText, wr.left * s, (vh - wr.bottom) * s, wr.right * s, (vh - wr.top) * s);
        gl.uniform4f(sp.u.uNav, nr.left * s, (vh - nr.bottom) * s, nr.right * s, (vh - nr.top) * s);
        sparks.draw([W / 2, H / 2], 0.55 * s);
      }

      // and the bloom of light at each pupil
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(halo.p); cam(halo); gl.bindVertexArray(hvao);
      gl.uniform3fv(halo.u.uPupil0, pupils[0]); gl.uniform3fv(halo.u.uPupil1, pupils[1]); gl.uniform2f(halo.u.uRes, W / 2, H / 2);
      gl.uniform1f(halo.u.uSize, (R[0] * 2.6) * (b.width * s / 2) / (tanX * CAMERA)); gl.uniform1f(halo.u.uFade, 0.75 + 0.25 * fade);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 2);
      // the original's finish: its warm dark behind, fine grain, darker corners (all fading out as the eyes scroll off)
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(qvao);
      pass(final, null, W, H, u => { bindTex(0, post.tex[0], u.uBase); gl.uniform1f(u.uTime, time * 0.0001 * 1000 % 1000); gl.uniform1f(u.uFade, fade); });
      gl.bindVertexArray(null); gl.depthMask(true);
    },
  };
}
