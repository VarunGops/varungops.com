/* The sparks on Now, after Jaume Sánchez's Whirly Bonfire (Codevember 2017), written from scratch. Each spark is born
   at the centre of a pupil and leaves along the eye's gaze; once clear of the eye it is caught by a 3D curl-noise
   current that whirls it across the screen, with a little lift, until it burns out. Drawn as a short streak along its
   velocity, white-hot when young and cooling through gold and orange to deep red, nearer sparks larger.
   Simulated on the GPU with WebGL 2 transform feedback: one buffer is read while the other is written, then they swap.
   The noise below is Ashima Arts' 3D simplex noise (Ian McEwan, Stefan Gustavson; MIT licence, (c) 2011 Ashima Arts). */

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
vec3 potential(vec3 p){ return vec3(snoise(p), snoise(p + vec3(31.4, -17.2, 9.7)), snoise(p + vec3(-23.1, 41.9, -13.3))); }
vec3 curl(vec3 p){                                    // swirls without sources or sinks
  const float e = .08;
  vec3 dx = vec3(e, 0., 0.), dy = vec3(0., e, 0.), dz = vec3(0., 0., e);
  vec3 px = potential(p + dx) - potential(p - dx), py = potential(p + dy) - potential(p - dy), pz = potential(p + dz) - potential(p - dz);
  return vec3(py.z - pz.y, pz.x - px.z, px.y - py.x)/(2.*e);
}`;

const UPDATE_VS = `#version 300 es
in vec3 aPos; in vec3 aVel; in vec2 aLife; in float aSeed;
uniform float uDt, uTime, uZmax; uniform vec3 uPupil0, uPupil1, uGaze0, uGaze1;
out vec3 oPos; out vec3 oVel; out vec2 oLife; out float oSeed;
${NOISE}
float hash(float n){ return fract(sin(n)*43758.5453123); }
void main(){
  vec3 p = aPos, v = aVel; float age = aLife.x + uDt, life = aLife.y;
  bool left = mod(floor(aSeed), 2.) < .5;
  vec3 P = left ? uPupil0 : uPupil1, g = left ? uGaze0 : uGaze1;
  bool unborn = aLife.x < 0.;
  if (unborn && age < 0.) {                                                // still waiting its turn
  } else if (unborn || age >= life || p.z > uZmax || abs(p.x) > 1400. || abs(p.y) > 1000.) {
    float k = aSeed*1.618 + floor(uTime*4.)*7.13;                            // born again, somewhere new
    vec3 r = vec3(hash(k), hash(k + 1.3), hash(k + 2.7))*2. - 1.;
    vec3 u1 = normalize(cross(vec3(0., 1., 0.), g)), u2 = cross(g, u1);
    p = P + (u1*r.x + u2*r.y)*1.3;                                          // from the centre of the pupil
    v = normalize(g + (u1*r.x + u2*r.y)*.45 + vec3(0., .3, 0.))*(60. + 55.*hash(k + 4.1));
    age = 0.; life = 3.5 + 5.5*hash(k + 5.9);
  } else {
    float loose = smoothstep(15., 75., distance(p, P));                     // clear of the eye, the current takes it
    vec3 f = curl(p*.021 + vec3(0., 0., uTime*.07))*46. + vec3(0., 10., 0.);
    v = mix(v, f, (1. - exp(-uDt*2.4))*loose);
    p += v*uDt;
  }
  oPos = p; oVel = v; oLife = vec2(age, life); oSeed = aSeed;
  gl_Position = vec4(0.);
}`;
const UPDATE_FS = `#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(0.); }`;

export function createSparks(gl, { count, CAM, GLOW_FS }) {
  const compile = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS) && !gl.isContextLost()) console.error(gl.getShaderInfoLog(o)); return o; };
  const up = gl.createProgram();
  gl.attachShader(up, compile(gl.VERTEX_SHADER, UPDATE_VS)); gl.attachShader(up, compile(gl.FRAGMENT_SHADER, UPDATE_FS));
  gl.transformFeedbackVaryings(up, ['oPos', 'oVel', 'oLife', 'oSeed'], gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(up);
  if (!gl.getProgramParameter(up, gl.LINK_STATUS)) { if (!gl.isContextLost()) console.warn('spark program did not link:', gl.getProgramInfoLog(up)); return null; }
  const uu = n => gl.getUniformLocation(up, n);
  const U = { dt: uu('uDt'), time: uu('uTime'), zmax: uu('uZmax'), p0: uu('uPupil0'), p1: uu('uPupil1'), g0: uu('uGaze0'), g1: uu('uGaze1') };

  const DRAW_VS = `#version 300 es
in vec2 aCorner; in vec3 iPos; in vec3 iVel; in vec2 iLife;
${CAM}
uniform vec2 uRes, uShift; uniform float uPx, uStreak;
out float vT; out float vAcross; out float vAlong; out float vNear;
void main(){
  vec4 a = camera(iPos), b = camera(iPos - iVel*uStreak);
  vec2 sa = a.xy/a.w*uRes, sb = b.xy/b.w*uRes, d = sa - sb; float L = length(d);
  vec2 dir = L > .001 ? d/L : vec2(1., 0.), nrm = vec2(-dir.y, dir.x);
  float near = clamp(260./a.w, .6, 4.), w = uPx*(.55 + .65*near);
  vec4 e = mix(b, a, aCorner.x);
  vec2 pos = e.xy/e.w*uRes + nrm*aCorner.y*w + dir*(aCorner.x*2. - 1.)*w + uShift*uRes;
  gl_Position = iLife.x < 0. ? vec4(2., 2., 2., 1.) : vec4(pos/uRes*e.w, e.z, e.w);
  vT = clamp(iLife.x/iLife.y, 0., 1.); vAcross = aCorner.y; vAlong = aCorner.x; vNear = near;
}`;
  const DRAW_FS = `#version 300 es
precision highp float;
in float vT; in float vAcross; in float vAlong; in float vNear;
uniform vec3 uMask;
${GLOW_FS}
out vec4 o;
vec3 ember(float t){                                   // white-hot, gold, orange, deep red
  return t < .08 ? mix(vec3(1., .97, .9), vec3(1., .82, .45), t/.08) : t < .4 ? mix(vec3(1., .82, .45), vec3(1., .45, .12), (t - .08)/.32) : mix(vec3(1., .45, .12), vec3(.75, .1, .06), (t - .4)/.6);
}
void main(){
  float across = exp(-vAcross*vAcross*3.), along = .25 + .75*vAlong*vAlong;             // brightest at the head
  float life = smoothstep(0., .04, vT)*pow(1. - vT, 1.3);
  vec3 c = ember(vT)*across*along*life*uGain/sqrt(vNear)*clearOfWords()*uFade*uMask;
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;
  const sh = (type, src) => compile(type, src);
  const dp = gl.createProgram(); gl.attachShader(dp, sh(gl.VERTEX_SHADER, DRAW_VS)); gl.attachShader(dp, sh(gl.FRAGMENT_SHADER, DRAW_FS)); gl.linkProgram(dp);
  if (!gl.getProgramParameter(dp, gl.LINK_STATUS)) { if (!gl.isContextLost()) console.warn('spark drawing did not link:', gl.getProgramInfoLog(dp)); return null; }
  const du = {}; const nu = gl.getProgramParameter(dp, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const inf = gl.getActiveUniform(dp, i); du[inf.name] = gl.getUniformLocation(dp, inf.name); }

  // state: position(3) velocity(3) age, life (2) seed (1). Each spark waits a random while before its first birth, so
  // they leave the eyes as a stream, not all at once.
  const STRIDE = 9, init = new Float32Array(count * STRIDE);
  let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) { init[i * STRIDE + 6] = -rnd() * 7; init[i * STRIDE + 7] = 1; init[i * STRIDE + 8] = i + rnd() * 0.5; }
  const bufs = [gl.createBuffer(), gl.createBuffer()];
  for (const b of bufs) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, init, gl.DYNAMIC_COPY); }
  const attrs = (prog, names, div) => names.forEach(([n, size, off]) => { const l = gl.getAttribLocation(prog, n); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, off * 4); gl.vertexAttribDivisor(l, div); });
  const upVao = bufs.map(b => { const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, b); attrs(up, [['aPos', 3, 0], ['aVel', 3, 3], ['aLife', 2, 6], ['aSeed', 1, 8]], 0); return v; });
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const drawVao = bufs.map(b => {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    const cl = gl.getAttribLocation(dp, 'aCorner'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b); attrs(dp, [['iPos', 3, 0], ['iVel', 3, 3], ['iLife', 2, 6]], 1); return v;
  });
  gl.bindVertexArray(null);
  const tf = gl.createTransformFeedback();
  let cur = 0;

  return {
    program: dp, uniforms: du,
    reset() { for (const b of bufs) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, init); } cur = 0; },
    // one step of the simulation; e: { pupils, gaze, zmax }
    step(dt, time, e) {
      gl.useProgram(up);
      gl.uniform1f(U.dt, dt); gl.uniform1f(U.time, time); gl.uniform1f(U.zmax, e.zmax);
      gl.uniform3fv(U.p0, e.pupils[0]); gl.uniform3fv(U.p1, e.pupils[1]); gl.uniform3fv(U.g0, e.gaze[0]); gl.uniform3fv(U.g1, e.gaze[1]);
      gl.bindVertexArray(upVao[cur]); gl.bindBuffer(gl.ARRAY_BUFFER, null);   // a buffer being written may not be bound anywhere else
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufs[1 - cur]);
      gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.bindVertexArray(null);
      cur = 1 - cur;
    },
    // the caller has set the camera and glow uniforms on `program`
    draw(res, px) {
      gl.uniform2fv(du.uRes, res); gl.uniform1f(du.uPx, px); gl.uniform1f(du.uStreak, 0.085);
      gl.bindVertexArray(drawVao[cur]);
      const split = 1.6 / res[0];                                       // a slight red-blue split, as in the reference
      for (const [mask, dx] of [[[1, 0, 0], -split], [[0, 1, 0], 0], [[0, 0, 1], split]]) {
        gl.colorMask(!!mask[0], !!mask[1], !!mask[2], true); gl.uniform3fv(du.uMask, mask); gl.uniform2f(du.uShift, dx, 0);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      }
      gl.colorMask(true, true, true, true); gl.bindVertexArray(null);
    },
  };
}
