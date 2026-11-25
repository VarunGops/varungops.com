/* The bonfire on Now, adapted from Jaume Sánchez's Whirly Bonfire (Codevember 2017, CC BY 4.0), following its recipe:
   a very large number of particles carried by a broad, slowly changing curl-noise current, so neighbours sweep in
   parallel as one whirlwind; each drawn as a tapered streak from where it was one step ago to where it is now, so
   nearer particles are larger and longer by perspective alone; one orange (#fb710c) shading to red at the tail, added
   together so dense parts burn towards yellow. Here the particles are born at the two eyes instead of in a cube.
   Simulated on the GPU with WebGL 2 transform feedback at a fixed 60 steps a second.
   The noise is Ashima Arts' 3D simplex noise (Ian McEwan, Stefan Gustavson; MIT licence, (c) 2011 Ashima Arts). */

const NOISE = `
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
}
vec3 potential(vec3 p){ return vec3(snoise(p), snoise(p + vec3(123.4, 129.8, -123.9)), snoise(p + vec3(-95.19, 90.51, -12.3))); }
vec3 curl(vec3 p){                                    // forward differences: four looks at the field, not six
  const float e = .05;
  vec3 c = potential(p), px = potential(p + vec3(e, 0., 0.)) - c, py = potential(p + vec3(0., e, 0.)) - c, pz = potential(p + vec3(0., 0., e)) - c;
  return vec3(py.z - pz.y, pz.x - px.z, px.y - py.x)/e;
}`;

const UPDATE_VS = `#version 300 es
in vec4 aState; in float aSeed;                       // position, life; a fixed random number per particle
uniform float uTime, uSpeed, uFreq, uSpawn, uZmax; uniform vec3 uPupil0, uPupil1;
out vec4 oState; out vec4 oPrev; out float oSeed;
${NOISE}
float hash(float n){ return fract(sin(n)*43758.5453123); }
void main(){
  vec4 s = aState;
  if (s.w < 0.) {                                       // still waiting its turn: the eyes pour steadily from the start
    s.w = min(0., s.w + .5);
    oPrev = vec4(s.xyz, s.w + 1.);
  } else if (s.w == 0. || s.z > uZmax) {                       // born again at one of the eyes, with a fresh life
    float k = aSeed*7.13 + floor(uTime*13.)*1.618;
    vec3 r = vec3(hash(k), hash(k + 1.7), hash(k + 3.1))*2. - 1.;
    vec3 P = mod(floor(aSeed), 2.) < .5 ? uPupil0 : uPupil1;
    s = vec4(P + normalize(r + 1e-4)*pow(hash(k + 4.3), .5)*uSpawn, 20. + 80.*hash(k + 5.9));
    oPrev = vec4(s.xyz, s.w + 1.);                     // a fresh particle draws nothing on its first step
  } else {
    oPrev = s;
    vec3 q = s.xyz*uFreq + vec3(uTime*.17, uTime*.11, uTime*.13);
    s.xyz += uSpeed*(curl(q)*.5 + curl(q*2.)*.25);    // a broad current with a finer one on top
    s.w = s.w - .05 <= 0. ? -.01 : s.w - .05;           // burnt out: born again on a later step
  }
  oState = s; oSeed = aSeed;
  gl_Position = vec4(0.);
}`;
const UPDATE_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(0.); }`;

export function createSparks(gl, { count, CAM, GLOW_FS }) {
  const compile = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS) && !gl.isContextLost()) console.error(gl.getShaderInfoLog(o)); return o; };
  const link = (vs, fs, varyings) => {
    const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { if (!gl.isContextLost()) console.warn('bonfire program did not link:', gl.getProgramInfoLog(p)); return null; }
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name] = gl.getUniformLocation(p, inf.name); }
    return { p, u };
  };
  const up = link(UPDATE_VS, UPDATE_FS, ['oState', 'oPrev', 'oSeed']);

  // the streak: a capsule from the tail (one step ago) to the head (now), tapering to a tenth of its width at the tail
  const DRAW_VS = `#version 300 es
in vec2 aCorner; in vec4 iState; in vec4 iPrev; in float iSeed;
${CAM}
uniform vec2 uRes, uShift; uniform float uPx;
out vec2 vLocal; out float vLen; out float vRad;
void main(){
  vec4 h = camera(iState.xyz), t = camera(iPrev.xyz);
  vec2 sh = h.xy/h.w*uRes, st = t.xy/t.w*uRes, d = sh - st; float L = length(d);
  vec2 dir = L > .001 ? d/L : vec2(1., 0.), nrm = vec2(-dir.y, dir.x);
  float size = .5 + 1.5*fract(iSeed*.6180339), r = uPx*size*clamp(400./h.w, .25, 12.);   // nearer: wider, by perspective
  vec2 pos = mix(st - dir*r, sh + dir*r, aCorner.x) + nrm*aCorner.y*r;
  bool dead = iPrev.w < iState.w || iState.w <= 0. || h.w < 8.;
  gl_Position = dead ? vec4(2., 2., 2., 1.) : vec4((pos + uShift*uRes)/uRes*h.w, h.z/h.w*h.w, h.w);
  vLocal = vec2(mix(-r, L + r, aCorner.x), aCorner.y*r); vLen = L; vRad = r;
}`;
  const DRAW_FS = `#version 300 es
precision highp float;
in vec2 vLocal; in float vLen; in float vRad;
uniform vec3 uMask;
${GLOW_FS}
out vec4 o;
void main(){
  float a = clamp(vLocal.x/max(vLen, 1e-3), 0., 1.);                        // 0 at the tail, 1 at the head
  float r = vRad*mix(.1, 1., a), dist = length(vec2(vLocal.x - a*vLen, vLocal.y));
  float edge = 1. - smoothstep(r*.78, r, dist);
  vec3 col = mix(vec3(1., 0., 0.), vec3(.984, .443, .047), .5 + .5*a);     // red at the tail, orange (#fb710c) at the head
  float alpha = edge*a*uGain*clearOfWords()*uFade;
  vec3 c = col*alpha*uMask;
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;
  const dp = link(DRAW_VS, DRAW_FS);
  if (!up || !dp) return null;

  // state: position(3) life(1) | previous position(3) previous life(1) | seed(1). Lives start staggered so the eyes pour
  // steadily from the first moment.
  const STRIDE = 9, init = new Float32Array(count * STRIDE);
  let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) { init[i * STRIDE + 3] = -rnd() * 40; init[i * STRIDE + 7] = 0; init[i * STRIDE + 8] = i + rnd() * 0.5; }
  const bufs = [gl.createBuffer(), gl.createBuffer()];
  for (const b of bufs) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, init, gl.DYNAMIC_COPY); }
  const attrs = (prog, names, div) => names.forEach(([n, size, off]) => { const l = gl.getAttribLocation(prog, n); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, off * 4); gl.vertexAttribDivisor(l, div); });
  const upVao = bufs.map(b => { const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, b); attrs(up.p, [['aState', 4, 0], ['aSeed', 1, 8]], 0); return v; });
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const drawVao = bufs.map(b => {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    const cl = gl.getAttribLocation(dp.p, 'aCorner'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b); attrs(dp.p, [['iState', 4, 0], ['iPrev', 4, 4], ['iSeed', 1, 8]], 1); return v;
  });
  gl.bindVertexArray(null);
  const tf = gl.createTransformFeedback();
  let cur = 0;

  return {
    program: dp.p, uniforms: dp.u,
    reset() { for (const b of bufs) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, init); } cur = 0; },
    // one 1/60 s step; e: { pupils, zmax }
    step(time, e) {
      gl.useProgram(up.p);
      gl.uniform1f(up.u.uTime, time); gl.uniform1f(up.u.uSpeed, e.speed); gl.uniform1f(up.u.uFreq, e.freq); gl.uniform1f(up.u.uSpawn, e.spawn); gl.uniform1f(up.u.uZmax, e.zmax);
      gl.uniform3fv(up.u.uPupil0, e.pupils[0]); gl.uniform3fv(up.u.uPupil1, e.pupils[1]);
      gl.bindVertexArray(upVao[cur]); gl.bindBuffer(gl.ARRAY_BUFFER, null);   // a buffer being written may not be bound anywhere else
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufs[1 - cur]);
      gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.bindVertexArray(null);
      cur = 1 - cur;
    },
    // the caller has set the camera and fade uniforms on `program`; the split is drawn here, two pixels as in the original
    draw(res, px) {
      gl.uniform2fv(dp.u.uRes, res); gl.uniform1f(dp.u.uPx, px);
      gl.bindVertexArray(drawVao[cur]);
      const split = 2 / res[0];
      for (const [mask, dx] of [[[1, 0, 0], -split], [[0, 1, 0], 0], [[0, 0, 1], split]]) {
        gl.colorMask(!!mask[0], !!mask[1], !!mask[2], true); gl.uniform3fv(dp.u.uMask, mask); gl.uniform2f(dp.u.uShift, dx, 0);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      }
      gl.colorMask(true, true, true, true); gl.bindVertexArray(null);
    },
  };
}
