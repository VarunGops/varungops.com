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
uniform vec2 uCentre; uniform vec3 uRing[6]; uniform int uCount; uniform float uScale;
${WORDS}
out vec4 o;
void main(){
  float d = distance(gl_FragCoord.xy, uCentre), v = 0.;
  for (int i = 0; i < 6; i++) {
    if (i >= uCount) break;
    vec3 r = uRing[i];                                          // radius, alpha, volley
    float w = uScale*(1.2 + r.x*.010/uScale);                   // wider, and softer, as it travels: out of focus at the edge
    float k = exp(-pow((d - r.x)/w, 2.))*r.y*(r.z > .5 ? 1. : .5);
    k += exp(-pow((d - r.x + w*3.)/(w*3.), 2.))*r.y*.12;       // a faint glow trailing inside each ring
    v += k;
  }
  v = 1. - exp(-v*1.4);
  vec3 c = vec3(1., .137, .22)*v*clearOfWords();                // --red
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export function createRings(canvas, { lite = false, preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, VS, FS); if (!pr) return null;
  const vao = gl.createVertexArray(), count = lite ? 4 : 6, ring = new Float32Array(18);
  const clear = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    size(scale) { const W = Math.max(2, Math.round(innerWidth * scale)), H = Math.max(2, Math.round(innerHeight * scale)); if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; } },
    clear,
    draw(t, v) {
      const speed = 0.16 * Math.hypot(v.W, v.H), rs = ringsAt(t, { count, speed });
      ring.fill(0); rs.forEach((r, i) => ring.set([r.radius, r.alpha, r.volley ? 1 : 0], i * 3));
      clear(); gl.useProgram(pr.p); gl.bindVertexArray(vao);
      gl.uniform2fv(pr.u.uCentre, v.centre); gl.uniform3fv(pr.u.uRing, ring); gl.uniform1i(pr.u.uCount, rs.length); gl.uniform1f(pr.u.uScale, v.scale);
      gl.uniform4fv(pr.u.uText, v.text); gl.uniform4fv(pr.u.uNav, v.nav);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    },
  };
}
