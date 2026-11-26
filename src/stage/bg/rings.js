/* About's background: rings that leave from behind the heart with each beat and widen until they leave the screen,
   after the expanding rings of Jaume Sánchez's DOF Tunnel (Codevember 2016, CC BY 4.0), written afresh. They read the
   same heartbeat clock as the heart (clock.js); every fourth beat, the volley, sends a brighter ring. */
import { beat, amp, T } from '../clock.js';
import { program } from '../gl.js';
import { WORDS } from './layer.js';

// The rings alive at time t, newest first: one for each of the last `count` beats, `speed` pixels a second.
export function ringsAt(t, { count = 6, speed }) {
  const { n } = beat(t), out = [];
  for (let i = 0; i < count && n - i >= 0; i++) {
    const k = n - i, age = t - k * T;
    out.push({ radius: age * speed, alpha: Math.max(0, 1 - age / (count * T)), volley: amp(k) === 1 });
  }
  return out;
}

const VS = `#version 300 es
void main(){ vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uCentre; uniform vec3 uRing[6]; uniform int uCount; uniform float uScale, uDiag, uTime, uBloom, uWide, uHeart;
${WORDS}
out vec4 o;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
void main(){
  vec2 q = gl_FragCoord.xy - uCentre; float d = length(q), v = 0., core = 0.;
  for (int i = 0; i < 6; i++) {
    if (i >= uCount) break;
    vec3 r = uRing[i];                                          // radius, alpha, volley
    float f = clamp(r.x/(.75*uDiag), 0., 1.);                   // how far out: 0 at the heart, 1 near the screen's edge
    float w = uScale*1.6*uWide*(1. + 3.*f)*(r.z > .5 ? 1.6 : 1.);   // crisp near the heart, three or four times softer far out
    float a = r.y*(1. - .7*f)*(r.z > .5 ? 1. : .35)*mix(1.5, 1., smoothstep(uHeart, 2.*uHeart, r.x));   // fainter outwards, and half as bright again round the heart; the volley stands out
    float x = (d - r.x)/w, k = exp(-x*x)*a;
    v += k + exp(-pow((d - r.x + w*3.)/(w*3.), 2.))*a*.1;     // a faint glow trailing inside each ring
    core += exp(-x*x*8.)*a*r.z*(1. - f);                       // the volley's hot centre line, near the heart
  }
  v += uBloom*exp(-pow(d/(190.*uScale), 2.))*.55;              // the heart flushes on the volley
  for (int i = 0; i < 4; i++) {                                // four out-of-focus discs drifting outwards, with the brighter rim of the demo's bokeh
    float fi = float(i), life = fract(uTime*.04 + hash(vec2(fi, 3.1))), ang = hash(vec2(fi, 7.7))*6.2832 + uTime*.03;
    vec2 c = vec2(cos(ang), sin(ang))*(1.3*uHeart + (.5*uDiag - 1.3*uHeart)*life);   // never inside 1.3 times the heart's radius
    float sz = uScale*(20. + 28.*hash(vec2(fi, 1.3))), e = length(q - c);
    v += smoothstep(sz, sz*.6, e)*(.25 + .75*smoothstep(sz*.3, sz*.8, e))*sin(3.1416*life)*.18;   // soft, hollow, faint
  }
  v = 1. - exp(-v*1.4);
  v *= 1. + .08*(hash(gl_FragCoord.xy + fract(uTime)*91.) - .5);   // film grain
  vec3 c = mix(vec3(1., .137, .22), vec3(1., .78, .82), clamp(core, 0., 1.)*.8)*v*clearOfWords();   // --red, pink-white at the volley's core
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export function createRings(canvas, { lite = false, preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, VS, FS); if (!pr) return null;
  const vao = gl.createVertexArray(), count = lite ? 5 : 6, ring = new Float32Array(18);
  const clear = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    size(scale) { const W = Math.max(2, Math.round(innerWidth * scale)), H = Math.max(2, Math.round(innerHeight * scale)); if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; } },
    clear,
    draw(t, v) {
      const speed = 0.35 * Math.min(v.W, v.H), rs = ringsAt(t, { count, speed });   // a third of the screen's shorter side a second: unhurried on a phone
      const vol = rs.find(r => r.volley), age = vol ? vol.radius / speed : 9;
      ring.fill(0); rs.forEach((r, i) => ring.set([r.radius, r.alpha, r.volley ? 1 : 0], i * 3));
      clear(); gl.useProgram(pr.p); gl.bindVertexArray(vao);
      gl.uniform2fv(pr.u.uCentre, v.centre); gl.uniform3fv(pr.u.uRing, ring); gl.uniform1i(pr.u.uCount, rs.length); gl.uniform1f(pr.u.uScale, v.scale); gl.uniform1f(pr.u.uDiag, Math.hypot(v.W, v.H)); gl.uniform1f(pr.u.uTime, t);
      gl.uniform1f(pr.u.uBloom, Math.exp(-age * 5)); gl.uniform1f(pr.u.uWide, lite ? 1.3 : 1); gl.uniform1f(pr.u.uHeart, Math.max(v.anchor[0], v.anchor[1]) / 2);
      gl.uniform4fv(pr.u.uText, v.text); gl.uniform4fv(pr.u.uNav, v.nav);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    },
  };
}
