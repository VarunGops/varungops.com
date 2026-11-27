/* Collaborate's background: a real fluid across the screen, after Pavel Dobryakov's WebGL Fluid Simulation (MIT),
   written afresh (stable fluids: advection, vorticity, a pressure solve). On every heartbeat (clock.js), as light
   crosses the corpus callosum in front, colour pours in from both edges of the screen at the tract's height, the two
   sides always a complementary pair (red from one, cyan from the other). The two jets come in one a little above the
   tract and one a little below, angled in, so they slide past each other and curl together in the middle; which is
   higher swaps each beat. The pair moves round the colour wheel with each push, so several pairs are swirling at once,
   the newest brightest. The volley pours hardest.
   A fixed step, so it behaves the same at any frame rate; fewer pressure iterations and a smaller grid on a phone. */
import { program } from '../gl.js';
import { beat, amp } from '../clock.js';
import { WORDS } from './layer.js';

const STEP = 1 / 60, POUR = 0.7;

const hsv = (h, s, v) => { const f = n => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };
// beat n's pair: hues 0, 30, 60, 90, 120, 150 degrees and their complements (red and cyan, orange and blue, yellow and
// violet...); on odd beats the warm one pours from the right
export function pairOf(n) {
  const h = (((n % 6) + 6) % 6) / 12, a = hsv(h, 0.85, 1), b = hsv((h + 0.5) % 1, 0.85, 1);
  return n % 2 === 0 ? { left: a, right: b } : { left: b, right: a };
}

// a cool colour lifted to pour as strongly as a warm one (the dye runs past 1; the screen tone-maps it)
const lift = c => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; const k = Math.min(2.6, Math.max(1, 0.6 / l)); return c.map(v => v * k); };
// beat n's push: the pair's two colours, one from each side, one jet 11% of the height above the tract and one below
export function pushOf(n) {
  const pair = pairOf(n), up = n % 2 === 0 ? 1 : -1;
  return { left: { color: lift(pair.left), y: 0.11 * up }, right: { color: lift(pair.right), y: -0.11 * up } };
}

// The time steps and the pushes, with no WebGL. advance() returns how many steps it ran; push(n, amp, t) is called as
// the sim crosses into beat n, before that step.
export function fluidClock() {
  let simT = null, warmT = null, lastN = null;
  return {
    advance(t, preserve, step, push, reset = () => {}) {
      if (preserve ? warmT !== t : simT == null) { reset(); simT = t - 4; warmT = t; lastN = beat(simT).n; }   // warmed up once (or once per fixed moment)
      else if (!preserve && t - simT > 0.5) { simT = t - STEP; lastN = beat(simT).n; }                         // back from a pause: carry on, do not catch up
      let k = 0;
      while (simT + STEP <= t && k < 260) { simT += STEP; const n = beat(simT).n; if (n !== lastN) { lastN = n; push(n, amp(n), simT); } step(simT); k++; }
      return k;
    },
  };
}

const VS = `#version 300 es
uniform vec2 uTexel;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
void main(){
  vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); vUv = p*.5 + .5;
  vL = vUv - vec2(uTexel.x, 0.); vR = vUv + vec2(uTexel.x, 0.); vT = vUv + vec2(0., uTexel.y); vB = vUv - vec2(0., uTexel.y);
  gl_Position = vec4(p, 0., 1.);
}`;
const HEAD = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB; out vec4 o;`;
const ADVECT = `${HEAD}
uniform sampler2D uVel, uSrc; uniform vec2 uSimTexel; uniform float uDt, uDiss;
void main(){ vec2 c = vUv - uDt*texture(uVel, vUv).xy*uSimTexel; o = texture(uSrc, c)/(1. + uDiss*uDt); }`;
const DIVERGE = `${HEAD}
uniform sampler2D uVel;
void main(){
  vec2 C = texture(uVel, vUv).xy; float L = texture(uVel, vL).x, R = texture(uVel, vR).x, T = texture(uVel, vT).y, B = texture(uVel, vB).y;
  if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;   // walls at the screen's edges
  o = vec4(.5*(R - L + T - B), 0., 0., 1.);
}`;
const CURL = `${HEAD}
uniform sampler2D uVel;
void main(){ o = vec4(.5*(texture(uVel, vR).y - texture(uVel, vL).y - texture(uVel, vT).x + texture(uVel, vB).x), 0., 0., 1.); }`;
const VORTEX = `${HEAD}
uniform sampler2D uVel, uCurlTex; uniform float uCurl, uDt;
void main(){
  float L = texture(uCurlTex, vL).x, R = texture(uCurlTex, vR).x, T = texture(uCurlTex, vT).x, B = texture(uCurlTex, vB).x, C = texture(uCurlTex, vUv).x;
  vec2 f = .5*vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= uCurl*C; f.y = -f.y;
  o = vec4(texture(uVel, vUv).xy + f*uDt, 0., 1.);
}`;
const PRESSURE = `${HEAD}
uniform sampler2D uPres, uDiv;
void main(){ o = vec4((texture(uPres, vL).x + texture(uPres, vR).x + texture(uPres, vT).x + texture(uPres, vB).x - texture(uDiv, vUv).x)*.25, 0., 0., 1.); }`;
const GRADIENT = `${HEAD}
uniform sampler2D uPres, uVel;
void main(){ vec2 g = vec2(texture(uPres, vR).x - texture(uPres, vL).x, texture(uPres, vT).x - texture(uPres, vB).x); o = vec4(texture(uVel, vUv).xy - g, 0., 1.); }`;
const FADE = `${HEAD}
uniform sampler2D uTex; uniform float uK;
void main(){ o = texture(uTex, vUv)*uK; }`;
const SPLAT = `${HEAD}
uniform sampler2D uTarget; uniform vec2 uPoint; uniform vec3 uColor; uniform float uAspect, uRadius;
void main(){ vec2 p = vUv - uPoint; p.x *= uAspect; o = vec4(texture(uTarget, vUv).rgb + uColor*exp(-dot(p, p)/uRadius), 1.); }`;
const SHOW = `${HEAD}
uniform sampler2D uDye; uniform vec2 uRes, uShift; uniform vec4 uArt; uniform float uFloor;
${WORDS}
void main(){
  vec3 d = max(texture(uDye, (gl_FragCoord.xy - uShift)/uRes).rgb, 0.);
  vec3 c = (1. - exp(-d*1.6))*clearOfWords()*mix(uFloor, 1., box(uArt, 40., 160.));   // never past white; quieter behind the tract, so it stays clear
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export function createFluid(canvas, { lite = false, preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: preserve });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;   // the solver needs float targets
  const P = {}; for (const [k, fs] of Object.entries({ advect: ADVECT, diverge: DIVERGE, curl: CURL, vortex: VORTEX, pressure: PRESSURE, gradient: GRADIENT, fade: FADE, splat: SPLAT, show: SHOW })) { P[k] = program(gl, VS, fs); if (!P[k]) return null; }
  const vao = gl.createVertexArray(), ITER = lite ? 14 : 30, SIM = lite ? 64 : 128, DYE = lite ? 256 : 512;
  const target = (w, h) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  };
  const double = (w, h) => { let a = target(w, h), b = target(w, h); return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, all: () => [a, b] }; };
  let G = null, aspect = 0, pours = [], warmC = [0, 0], clock = fluidClock();
  const grid = (base, asp) => asp >= 1 ? [Math.round(base * asp), base] : [base, Math.round(base / asp)];
  const build = asp => {
    if (G) for (const x of [...G.vel.all(), ...G.dye.all(), ...G.pres.all(), G.div, G.curl]) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); }
    const [sw, sh] = grid(SIM, asp), [dw, dh] = grid(DYE, asp);
    G = { vel: double(sw, sh), pres: double(sw, sh), div: target(sw, sh), curl: target(sw, sh), dye: double(dw, dh) };
    aspect = asp; clock = fluidClock(); blank();
  };
  const blank = () => { for (const x of [...G.vel.all(), ...G.dye.all(), ...G.pres.all(), G.div, G.curl]) { gl.bindFramebuffer(gl.FRAMEBUFFER, x.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } pours = []; };
  // run a program into a target, its textures bound in order to units 0, 1
  const pass = (pr, out, tex, set) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.f); gl.viewport(0, 0, out.w, out.h); gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uTexel, 1 / out.w, 1 / out.h);
    tex.forEach(([loc, x], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, x.t); gl.uniform1i(loc, i); });
    if (set) set(pr.u); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const splat = (d, x, y, col, r) => {
    pass(P.splat, d.write, [[P.splat.u.uTarget, d.read]], u => { gl.uniform2f(u.uPoint, x, y); gl.uniform3fv(u.uColor, col); gl.uniform1f(u.uAspect, aspect); gl.uniform1f(u.uRadius, r); }); d.swap();
  };
  const hash = n => { const s = Math.sin(n * 91.345 + 7.1) * 43758.5453; return s - Math.floor(s); };
  // one fixed step at sim time s: the pours still running, then the solve and the advection
  const step = (s, cy) => {
    const { vel, pres, dye } = G;
    for (const p of pours) {
      const age = s - p.t0; if (age < 0 || age > POUR) continue;
      const k = 1 - age / POUR, push = pushOf(p.n), y0 = cy + (hash(p.n) - 0.5) * 0.08, F = 450 * p.a * k, c10 = Math.cos(0.175), s10 = Math.sin(0.175);
      for (const [side, x, dir] of [[push.left, 0.01, 1], [push.right, 0.99, -1]]) {
        const y = y0 + side.y, toward = -Math.sign(side.y);                    // angled 10 degrees in, towards the tract's height
        splat(vel, x, y, [dir * F * c10, toward * F * s10, 0], 0.006);          // pushed wider than it is coloured: it streams in as a jet
        splat(dye, x, y, side.color.map(c => c * (0.3 + 0.4 * p.a) * k), 0.003);
      }
    }
    pours = pours.filter(p => s - p.t0 <= POUR);
    pass(P.curl, G.curl, [[P.curl.u.uVel, vel.read]]);
    pass(P.vortex, vel.write, [[P.vortex.u.uVel, vel.read], [P.vortex.u.uCurlTex, G.curl]], u => { gl.uniform1f(u.uCurl, 11); gl.uniform1f(u.uDt, STEP); }); vel.swap();
    pass(P.diverge, G.div, [[P.diverge.u.uVel, vel.read]]);
    pass(P.fade, pres.write, [[P.fade.u.uTex, pres.read]], u => gl.uniform1f(u.uK, 0.8)); pres.swap();
    for (let i = 0; i < ITER; i++) { pass(P.pressure, pres.write, [[P.pressure.u.uPres, pres.read], [P.pressure.u.uDiv, G.div]]); pres.swap(); }
    pass(P.gradient, vel.write, [[P.gradient.u.uPres, pres.read], [P.gradient.u.uVel, vel.read]]); vel.swap();
    const adv = (src, diss) => pass(P.advect, src.write, [[P.advect.u.uVel, vel.read], [P.advect.u.uSrc, src.read]], u => { gl.uniform2f(u.uSimTexel, 1 / vel.read.w, 1 / vel.read.h); gl.uniform1f(u.uDt, STEP); gl.uniform1f(u.uDiss, diss); });
    adv(vel, 0.2); vel.swap();
    adv(dye, 0.9); dye.swap();                                    // old colour fades over a few beats: several pairs show, the newest brightest
  };
  const clear = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    size(scale) {
      const W = Math.max(2, Math.round(canvas.clientWidth * scale)), H = Math.max(2, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const asp = W / H; if (!G || Math.abs(Math.log(asp / aspect)) > 0.25) build(asp);   // a phone's address bar does not start it again; turning the phone does
    },
    clear,
    draw(t, v) {
      gl.bindVertexArray(vao);
      const c = v.centre, cy = c[1] / canvas.height;
      clock.advance(t, preserve, s => step(s, preserve ? warmC[1] / canvas.height : cy), (n, a, s) => pours.push({ n, a, t0: s }), () => { blank(); warmC = c; });
      clear(); gl.useProgram(P.show.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.dye.read.t); gl.uniform1i(P.show.u.uDye, 0);
      gl.uniform2f(P.show.u.uTexel, 1 / canvas.width, 1 / canvas.height); gl.uniform2f(P.show.u.uRes, canvas.width, canvas.height);
      gl.uniform2f(P.show.u.uShift, preserve ? c[0] - warmC[0] : 0, preserve ? c[1] - warmC[1] : 0);   // a fixed moment moves with the page as it scrolls
      const a = v.anchor, fx = lite ? 0.42 : 0.25; gl.uniform4f(P.show.u.uArt, c[0] - a[0] * fx, c[1] - a[1] * 0.4, c[0] + a[0] * fx, c[1] + a[1] * 0.4);   // on a phone the tract spans the screen
      gl.uniform1f(P.show.u.uFloor, lite ? 0.2 : 0.3); gl.uniform4fv(P.show.u.uText, v.text); gl.uniform4fv(P.show.u.uNav, v.nav);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    },
  };
}
