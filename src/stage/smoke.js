/* The shockwave: a ragged white smoke front on every fourth beat. It leaves from the brain's outline, never its centre,
   spreads evenly in every direction, frays into wisps and fades well above the heart. */
import { T, BURST_EVERY, BURST_DELAY, beat, burstAge, burstSeed } from './clock.js';

const SMOKE_FS = `
precision highp float;
uniform vec2 uRes, uC; uniform float uR0, uRmax, uFade0, uFade1; uniform vec2 uAge, uSeed;
uniform sampler2D uSdf; uniform vec4 uBox; uniform float uPx;   // the brain's outline as a distance field: page box it covers, and px per mm
float outside(vec2 p){                                          // px from the brain's outline; negative inside it
  vec2 pc = clamp(p, uBox.xy + 1., uBox.xy + uBox.zw - 1.);
  return texture2D(uSdf, (pc - uBox.xy)/uBox.zw).r*uPx + length(p - pc);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a*noise(p); p = p*2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
vec3 wheel(float ang){ float h = fract(265./360. + ang/6.2831853); return clamp(abs(fract(h + vec3(0., 2./3., 1./3.))*6. - 3.) - 1., 0., 1.); }
vec4 burst(vec2 p, float sd, float age, float seed){
  const float LIFE = 4.2;
  if (age < 0. || age > LIFE) return vec4(0.);
  float t = age/LIFE;
  float D = (uRmax - uR0)*(1. - pow(1. - t, 2.2));            // how far the front has travelled from the brain's surface: fast, then slowing
  vec2 d = p - uC; float r = length(d); vec2 dir = d/max(r, 1e-3);
  float rag = fbm(dir*2.6 + seed + vec2(0., age*.12)) - .5;   // the front wanders with direction: tongues and bays
  float rag2 = fbm(dir*7. + seed*1.7 - vec2(age*.2, 0.)) - .5;
  float rag3 = fbm(dir*19. + seed*2.3) - .5;
  float Dn = D*(1. + .42*rag + .2*rag2 + .08*rag3);           // it leaves as the brain's exact outline and only then goes ragged
  float x = (uR0 + sd)/(uR0 + Dn);                           // 1 at the front
  float edge = smoothstep(.93, 1., x)*smoothstep(1.035, 1., x);                // the thin leading edge
  float shell = smoothstep(.5 + .12*t, .97, x)*smoothstep(1.03, .995, x);     // smoke hangs just behind it
  vec2 q = d/(uR0 + D)*4.2 + seed;                           // noise rides the expanding wave, so wisps stretch with it
  vec2 w = vec2(fbm(q + vec2(0., age*.35)), fbm(q + vec2(5.2, -age*.3)));
  float n = fbm(q*1.5 + 3.4*w), n2 = fbm(q*4.5 + 4.*w + 7.);
  float wisps = pow(1. - abs(2.*n - 1.), 6.) + .6*pow(1. - abs(2.*n2 - 1.), 8.);   // ridged noise reads as filaments
  float th = mix(.16, .62, t);                                                // filaments thin out as the smoke ages
  float streak = pow(noise(dir*46. + seed), 6.)*smoothstep(.3, .9, x)*smoothstep(1.02, .9, x)*pow(1. - t, 3.);
  float clear = smoothstep(-1.5*uPx, 2.5*uPx, sd);            // nothing over the brain itself: the wave starts at its surface
  float dens = (shell*(.05 + .95*smoothstep(th, th + .5, wisps)) + edge*(.2 + 1.1*smoothstep(.08, .7, wisps)) + streak*.4)*clear;
  float fade = pow(1. - t, 1.5)*smoothstep(0., .02, t);
  float lit = exp(-sd*sd/(uPx*uPx*22.))*pow(1. - t, 14.);     // at launch the whole outline of the brain lights, and the front lifts off it
  float I = 1. - exp(-1.7*(dens*fade + lit*1.3));            // soft shoulder, so dense smoke never clips to a flat white
  float hot = clamp(edge*1.5 + lit, 0., 1.);
  vec3 tint = mix(vec3(1.), wheel(atan(d.y, d.x)), .5);       // white-hot front; a wash of the brain's colour in the smoke behind it
  return vec4(mix(tint, vec3(1.), hot)*I, I);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float sd = outside(p);
  vec4 c = burst(p, sd, uAge.x, uSeed.x) + burst(p, sd, uAge.y, uSeed.y);
  c *= 1. - smoothstep(uFade0, uFade1, p.y);
  gl_FragColor = vec4(min(c.rgb, vec3(1.)), clamp(max(c.r, max(c.g, c.b)), 0., 1.));
}`;

export function createSmoke(canvas, { preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS) && !gl.isContextLost()) console.error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, SMOKE_FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const u = {}; for (const n of ['uRes', 'uC', 'uR0', 'uRmax', 'uFade0', 'uFade1', 'uAge', 'uSeed', 'uSdf', 'uBox', 'uPx']) u[n] = gl.getUniformLocation(pr, n);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.uniform1i(u.uSdf, 0); gl.disable(gl.BLEND);
  const S = 0.5;                              // half resolution: smoke is soft, and this keeps the cost down
  let h = 0, hasField = false, last = null;

  const Smoke = {
    gl,
    get height() { return h; },
    size(G) {
      h = Math.min(G.fieldH, Math.round(G.H * 1.9));
      canvas.width = Math.round(G.W * S); canvas.height = Math.round(h * S);
      canvas.style.width = G.W + 'px'; canvas.style.height = h + 'px';
      last = null;                            // a new layout takes a new outline
    },
    field(f32, w, hh) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, hh, 0, gl.RED, gl.FLOAT, f32); hasField = true; },
    clear() { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
    // outlineAt(t) returns the brain's outline field as the brain is turned at time t
    draw(t, G, outlineAt) {
      const b = Math.floor(beat(t).n / BURST_EVERY) * BURST_EVERY;
      if (b !== last) { last = b; const f = outlineAt(b * T + BURST_DELAY + 0.3); if (f) Smoke.field(f, f.w, f.h); }
      if (!hasField) return;
      gl.useProgram(pr); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform2f(u.uC, G.px * S, G.py * S);
      gl.uniform1f(u.uR0, 62 * G.k * S); gl.uniform1f(u.uRmax, (0.62 * Math.hypot(G.W, G.H) + 40) * S);
      gl.uniform4f(u.uBox, G.box[0] * S, G.box[1] * S, G.box[2] * S, G.box[3] * S); gl.uniform1f(u.uPx, G.k * S);
      gl.uniform1f(u.uFade0, (h - 0.9 * G.H) * S); gl.uniform1f(u.uFade1, (h - 0.22 * G.H) * S);   // the smoke is gone well above the heart
      gl.uniform2f(u.uAge, burstAge(t, 0), burstAge(t, 1)); gl.uniform2f(u.uSeed, burstSeed(t, 0), burstSeed(t, 1));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
  return Smoke;
}
