/* Clinical Experience's background: a field of fine graphite strokes that all follow a slow current, darker and
   lighter in patches like pencil shading, after Jaume Sánchez's Lines on a sphere (Codevember 2016, CC BY 4.0),
   opened out flat and written afresh. Two passes: the current's direction into a small texture (it changes slowly
   and smoothly, so an eighth of the size is enough), then a line-integral pass that smears a fine grain along it
   into strokes, the grain slowly travelling along the strokes. Drawn at half size (a third on a phone), at most
   thirty times a second. Noise: Ashima Arts' 3D simplex (Ian McEwan, Stefan Gustavson; MIT). */
import { program } from '../gl.js';
import { WORDS } from './layer.js';

const SIMPLEX = `
vec3 mod289(vec3 x){ return x - floor(x*(1./289.))*289.; }
vec4 mod289(vec4 x){ return x - floor(x*(1./289.))*289.; }
vec4 permute(vec4 x){ return mod289(((x*34.) + 1.)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - .85373472095314*r; }
float snoise(vec3 v){
  const vec2 C = vec2(1./6., 1./3.); const vec4 D = vec4(0., .5, 1., 2.);
  vec3 i = floor(v + dot(v, C.yyy)), x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz), l = 1. - g, i1 = min(g.xyz, l.zxy), i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx, x2 = x0 - i2 + C.yyy, x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0., i1.z, i2.z, 1.)) + i.y + vec4(0., i1.y, i2.y, 1.)) + i.x + vec4(0., i1.x, i2.x, 1.));
  float n_ = .142857142857; vec3 ns = n_*D.wyz - D.xzx;
  vec4 j = p - 49.*floor(p*ns.z*ns.z), x_ = floor(j*ns.z), y_ = floor(j - 7.*x_);
  vec4 x = x_*ns.x + ns.yyyy, y = y_*ns.x + ns.yyyy, h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy), b1 = vec4(x.zw, y.zw), s0 = floor(b0)*2. + 1., s1 = floor(b1)*2. + 1., sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy, a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x), p1 = vec3(a0.zw, h.y), p2 = vec3(a1.xy, h.z), p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.); m = m*m;
  return 42.*dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`;

const VS = `#version 300 es
void main(){ vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.); gl_Position = vec4(p, 0., 1.); }`;

// the current: the direction of the curl of a slowly changing noise, with a slower, larger noise for the shading
const FIELD_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime, uFreq;              // uRes: the field's size; uFreq: per field pixel
${SIMPLEX}
out vec4 o;
void main(){
  vec2 p = gl_FragCoord.xy*uFreq; float z = uTime*.02, e = .02;
  float n = snoise(vec3(p, z)), nx = snoise(vec3(p + vec2(e, 0.), z)), ny = snoise(vec3(p + vec2(0., e), z));
  vec2 v = vec2(ny - n, -(nx - n)); v /= max(length(v), 1e-6);
  float shade = smoothstep(-.35, .65, snoise(vec3(p*.45, uTime*.01 + 7.)));
  o = vec4(v*.5 + .5, shade, 1.);
}`;

// the strokes: a fine grain smeared along the current, the grain travelling slowly along each stroke
const LIC_FS = `#version 300 es
precision highp float;
uniform sampler2D uField; uniform vec2 uRes; uniform float uTime, uGain, uGrain;
${WORDS}
out vec4 o;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
vec2 dir(vec2 p){ return texture(uField, p/uRes).xy*2. - 1.; }
float grain(vec2 p, float s){                          // smooth (bilinear) grain, so no little squares show
  vec2 q = p/uGrain, c = floor(q), f = smoothstep(0., 1., fract(q));
  float h = mix(mix(hash(c), hash(c + vec2(1., 0.)), f.x), mix(hash(c + vec2(0., 1.)), hash(c + 1.), f.x), f.y);
  return h*(.6 + .4*sin(s*.5 - uTime*1.6 + h*6.283));
}
void main(){
  vec2 p0 = gl_FragCoord.xy, a = p0, b = p0; float s = 0., w = 0.;
  for (int i = 0; i < 16; i++) {                      // along the current both ways from this pixel
    float k = 1. - float(i)/16.;
    a += dir(a)*1.5; b -= dir(b)*1.5;
    s += (grain(a, float(i)) + grain(b, -float(i)))*k; w += 2.*k;
  }
  float v = pow(clamp((s/w - .30)*7. + .5, 0., 1.), 1.6), shade = texture(uField, p0/uRes).z;
  float g = v*(.25 + .75*shade)*uGain*clearOfWords();
  vec3 c = vec3(.62, .62, .64)*g;                     // graphite
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export function createFlow(canvas, { lite = false, preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const field = program(gl, VS, FIELD_FS), lic = program(gl, VS, LIC_FS);
  if (!field || !lic) return null;
  const vao = gl.createVertexArray(), q = lite ? 1 / 3 : 1 / 2;          // drawn at this fraction of the canvas's own scale
  let tex = null, fb = null, fw = 0, fh = 0, last = -1;
  const makeField = () => {
    if (tex) { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); }
    fw = Math.max(2, Math.ceil(canvas.width / 8)); fh = Math.max(2, Math.ceil(canvas.height / 8));
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  const clear = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    size(scale) {
      const W = Math.max(2, Math.round(innerWidth * scale * q)), H = Math.max(2, Math.round(innerHeight * scale * q));
      if (canvas.width !== W || canvas.height !== H || !tex) { canvas.width = W; canvas.height = H; makeField(); }
      last = -1;
    },
    clear,
    draw(t, v) {
      if (!preserve && last >= 0 && t - last < 1 / 30) return;               // at most thirty strokes-frames a second
      last = t;
      const k = canvas.width / v.W, px = v.scale * q;                         // the layer's boxes are in full-scale canvas pixels
      gl.bindVertexArray(vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, fw, fh); gl.useProgram(field.p);
      gl.uniform1f(field.u.uTime, t); gl.uniform1f(field.u.uFreq, 8 / (300 * px));   // a swirl about 300 CSS pixels across
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      clear(); gl.useProgram(lic.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(lic.u.uField, 0);
      gl.uniform2f(lic.u.uRes, canvas.width, canvas.height); gl.uniform1f(lic.u.uTime, t);
      gl.uniform1f(lic.u.uGain, lite ? 0.7 : 0.6); gl.uniform1f(lic.u.uGrain, Math.max(1.5, 2.6 * px));
      gl.uniform4fv(lic.u.uText, v.text.map(x => x * k)); gl.uniform4fv(lic.u.uNav, v.nav.map(x => x * k));
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    },
  };
}
