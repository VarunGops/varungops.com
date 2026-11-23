/* varungops.com home stage.
   A real brain: the cortex surface comes from the MNI ICBM 2009c MRI template, the lobes from the CerebrA atlas,
   and the fibres inside it from the HCP-1065 tractography atlas. Nothing here is drawn by hand. */
const TAU = Math.PI * 2, T = 0.96;            // T = one heartbeat, seconds
const YC = -16, ZC = 15;                      // the model point (mm) that sits on the page's centre line, under the name
const TA = 0.36;                              // seconds from a beat to its impulse reaching the cortex
const SPEED = 1 / TA;                         // a pathway runs from 0 at the centre of the brain to 1 at its end
const CORD_RATE = 54;                         // mm of cord travelled per unit of that speed (about 150 mm/s)
const ZJ = -67, ZREF = -50;                   // where the medulla becomes the cord (mm), and where the cord impulse starts its count
const CENTRE = [0, -18, 6];                   // thalamus and upper brainstem: where every beat's impulse starts
const BURST_EVERY = 4, BURST_DELAY = TA;      // every fourth beat is a full volley, and its smoke leaves as the impulse reaches the surface
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const $ = s => document.querySelector(s);
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const Q = new URLSearchParams(location.search);
const FROZEN = Q.get('age') == null ? null : +Q.get('age'); // review aids: ?age=1.2 freezes the burst, ?yaw=0.3 fixes the view
const YAW = Q.get('yaw') == null ? null : +Q.get('yaw');
const HEART_YAW = Q.get('hyaw') == null ? null : +Q.get('hyaw'), HEART_AGE = Q.get('hage') == null ? null : +Q.get('hage');
const NO_SMOKE = Q.get('smoke') === '0', NO_MESH = Q.get('mesh') === '0', NO_TRACTS = Q.get('tracts') === '0';
const yawAt = t => YAW != null ? YAW : 0.16 + 0.26 * Math.sin(t * 0.21);

const G = {};
const home = $('#home'), nameEl = $('.name'), mainEl = $('main'), stageC = $('#stage');
const heartEl = $('#heart'), track = $('.track'), spine = $('.spine'), markerEl = $('.marker'), mlabel = $('#mlabel');
const secs = [...document.querySelectorAll('[data-label]')];
const sg = stageC.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, stencil: true });

/* ---------- shaders ---------- */
const PROJ = `
uniform vec4 uView;   // cos yaw, sin yaw, page px per mm, unused
uniform vec2 uAnchor; // page px of the model origin
uniform vec2 uRes;    // stage size in page px
vec3 proj(vec3 p){    // MNI mm (x right, y anterior, z up), seen from the right side and turned by the yaw. z out = mm towards the viewer
  float yp = p.y - (${YC}.), zp = p.z - (${ZC}.);
  float yr = yp*uView.x - p.x*uView.y, xr = yp*uView.y + p.x*uView.x;
  return vec3(uAnchor.x + yr*uView.z, uAnchor.y - zp*uView.z, xr);
}
vec4 clip(vec3 s){ return vec4(s.x/uRes.x*2. - 1., 1. - s.y/uRes.y*2., -s.z/300., 1.); }`;

const MESH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in float aDepth;
layout(location=3) in float aRelief; layout(location=4) in vec3 aCol; layout(location=5) in float aFade;
${PROJ}
out vec3 vCol; out float vDepth; out float vRel; out vec3 vN; out float vZ; out float vFade;
void main(){
  gl_Position = clip(proj(aPos)); vRel = aRelief/24.;
  vN = vec3(aNrm.y*uView.x - aNrm.x*uView.y, aNrm.z, aNrm.y*uView.y + aNrm.x*uView.x); // right, up, towards the viewer
  vCol = aCol; vDepth = aDepth/12.; vZ = aPos.z; vFade = aFade;
}`;
const MESH_FS = `#version 300 es
precision highp float;
in vec3 vCol; in float vDepth; in float vRel; in vec3 vN; in float vZ; in float vFade;
uniform float uBeat, uCutZ;
out vec4 o;
void main(){
  if (vZ < uCutZ) discard;                                      // the medulla stops where the cord's own surface takes over
  vec3 n = normalize(vN);
  float rim = pow(1. - clamp(n.z, 0., 1.), 2.4);
  float w = fwidth(vRel)*1.25 + 1e-4;
  float lip = 1. - smoothstep(0., w, abs(vRel + .05));           // one fine line where each gyrus turns down into its sulcus
  float crown = smoothstep(-.25, .55, vRel);                    // gyral crowns carry the light, sulci stay dark
  float fissure = 1. - smoothstep(2.5, 7., vDepth);             // the deep fissures (Sylvian, longitudinal) fall to black
  float lit = .3 + .7*clamp(dot(n, normalize(vec3(.3, .55, .78))), 0., 1.);
  float I = (crown*(.15 + .32*lit)*fissure + lip*.85 + rim*.6)*(.8 + .55*uBeat)*vFade;
  vec3 c = mix(vCol, vec3(1.), lip*.4 + rim*.15)*I;
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;
const SIL_FS = `#version 300 es
precision highp float;
in float vZ; uniform float uCutZ; out vec4 o;
void main(){ if (vZ < uCutZ) discard; o = vec4(1.); }`;

const LINE_IN = `layout(location=0) in vec2 aCorner;            // x: 0 at a, 1 at b; y: -1 or +1 across the line
layout(location=1) in vec3 aA; layout(location=2) in vec3 aB; layout(location=3) in vec2 aS; layout(location=4) in vec3 aCol; layout(location=5) in float aW;`;
const COMET = `
uniform vec4 uHead, uAmp; uniform float uPulseW, uTail;
float volley(float s){           // each beat's impulse: a sharp front with a tail behind it
  float p = 0.;
  for (int i = 0; i < 4; i++){ float h = uHead[i]; if (h >= 0.){ float d = s - h; p += uAmp[i]*(d > 0. ? exp(-d*d/(uPulseW*uPulseW)) : exp(d/uTail)); } }
  return p;
}`;

/* Fibres: every streamline is drawn as a lit strand with a thin dark halo, depth-sorted against the others.
   This is how tractography is normally rendered, and it is what lets a bundle read as a bundle. */
const FIBRE_VS = `#version 300 es
${LINE_IN}
${PROJ}
uniform float uHalo, uWide;
out vec3 vCol; out float vS; out float vSide; out float vZ; flat out vec2 vN;
void main(){
  vec3 a = proj(aA), b = proj(aB);
  vec2 d = b.xy - a.xy; float L = length(d); vec2 t = L > 1e-4 ? d/L : vec2(0., 1.); vec2 n = vec2(-t.y, t.x);
  float core = abs(aW)*uWide, hw = core*(1. + uHalo);
  vec2 p = mix(a.xy, b.xy, aCorner.x) + t*(aCorner.x*2. - 1.)*core*.6 + n*aCorner.y*hw;
  float z = mix(a.z, b.z, aCorner.x);
  gl_Position = clip(vec3(p, z));
  vCol = aCol; vS = mix(aS.x, aS.y, aCorner.x); vSide = aCorner.y*(1. + uHalo); vZ = z; vN = n;
}`;
const FIBRE_FS = `#version 300 es
precision highp float;
in vec3 vCol; in float vS; in float vSide; in float vZ; flat in vec2 vN;
uniform float uHalo, uBeat;
${COMET}
out vec4 o;
void main(){
  float av = abs(vSide), v = clamp(vSide, -1., 1.);
  float core = 1. - smoothstep(.72, 1.12, av);
  vec3 N = normalize(vec3(vN*v*.94, sqrt(1. - .88*v*v)));
  vec3 Ld = normalize(vec3(-.42, -.62, .66));
  float diff = max(dot(N, Ld), 0.);
  float spec = pow(max(dot(N, normalize(Ld + vec3(0., 0., 1.))), 0.), 22.);
  float fog = clamp(.6 + vZ/110., .12, 1.);                      // the far hemisphere sits back in the dark
  float pulse = volley(vS);
  vec3 c = (vCol*(.2 + .62*diff) + .1*spec)*fog*(.85 + .3*uBeat);
  c += (vCol*.7 + .5)*pulse*1.2*mix(.4, 1., fog);
  gl_FragDepth = gl_FragCoord.z + clamp((av - 1.)/uHalo, 0., 1.)*.012;   // the halo only hides fibres well behind this one
  o = vec4(c*core, 1.);
}`;

/* Additive lines: the glow of an impulse shining through the brain, and the single thread that runs to the heart. */
const LINE_VS = `#version 300 es
${LINE_IN}
${PROJ}
uniform float uDepthFade, uWide;
out vec3 vCol; out float vS; out float vSide; out float vKind;
void main(){
  vec3 a = proj(aA), b = proj(aB);
  vec2 d = b.xy - a.xy; float L = length(d); vec2 t = L > 1e-4 ? d/L : vec2(0., 1.); vec2 n = vec2(-t.y, t.x);
  float hw = aW < 0. ? -aW : aW*uWide;
  vec2 p = mix(a.xy, b.xy, aCorner.x) + n*aCorner.y*hw;
  gl_Position = clip(vec3(p, 0.));
  float near = clamp(.55 + (a.z + b.z)/240., .2, 1.);
  vCol = aCol*mix(1., near, uDepthFade); vS = mix(aS.x, aS.y, aCorner.x); vSide = aCorner.y; vKind = aW < 0. ? 1. : 0.;
}`;
const LINE_FS = `#version 300 es
precision highp float;
in vec3 vCol; in float vS; in float vSide; in float vKind;
uniform float uGain, uPulseGain;
${COMET}
out vec4 o;
void main(){
  float edge = 1. - abs(vSide);
  float prof = mix(edge*edge, edge, vKind);          // the single thread uses a plain linear falloff, to match the CSS line it hands over to
  vec3 hot = mix(vCol*.8 + .3, vCol*.55 + .5, vKind);
  vec3 c = vCol*uGain*prof + hot*volley(vS)*prof*uPulseGain*length(vCol);
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`;

function program(gl, vs, fs) {
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o), src.split('\n').slice(0, 3).join(' ')); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  return { p, u, a: name => gl.getAttribLocation(p, name) };
}

/* ---------- data ---------- */
const REGION_COL = [[.8, .8, .8], [.24, .6, 1], [1, .8, .22], [.22, 1, .52], [1, .3, .42], [.18, .95, .9], [.92, .92, .96], [.72, .45, 1], [1, .58, .22]];
// unlabelled, frontal, parietal, temporal, occipital, limbic, insula, cerebellum, brainstem
const STEM = REGION_COL[8], RED = [1, 0.137, 0.22];

function buildMesh(gl, bj, bb) {
  const nv = bj.verts, q = new Uint16Array(bb, 0, nv * 3), n8 = new Int8Array(bb, nv * 6, nv * 3), d8 = new Uint8Array(bb, nv * 9, nv), reg = new Uint8Array(bb, nv * 10, nv);
  const rel = new Int8Array(bb, nv * 11, nv), idx = new Uint32Array(bb, nv * 12, bj.faces * 3);
  const pos = new Float32Array(nv * 3), col = new Uint8Array(nv * 3);
  for (let i = 0; i < nv; i++) for (let a = 0; a < 3; a++) {
    pos[i * 3 + a] = bj.lo[a] + q[i * 3 + a] / 65535 * (bj.hi[a] - bj.lo[a]);
    col[i * 3 + a] = Math.round(REGION_COL[reg[i]][a] * 255);
  }
  // the brainstem's own cross-section, measured from the surface, so the cord can leave it without a step
  const fit = (z, tol) => { let rx = 0, y0 = 1e9, y1 = -1e9; for (let i = 0; i < nv; i++) if (reg[i] === 8 && Math.abs(pos[i * 3 + 2] - z) < tol) { rx = Math.max(rx, Math.abs(pos[i * 3])); y0 = Math.min(y0, pos[i * 3 + 1]); y1 = Math.max(y1, pos[i * 3 + 1]); } return { yc: (y0 + y1) / 2, ry: (y1 - y0) / 2, rx }; };
  G.stemTop = fit(ZREF, 1.6); G.stemJ = fit(ZJ, 1.3); G.stemJ2 = fit(ZJ + 4, 1.3);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (loc, data, size, type, norm) => { gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr(0, pos, 3, gl.FLOAT, false); attr(1, n8, 3, gl.BYTE, true); attr(2, d8, 1, gl.UNSIGNED_BYTE, false); attr(3, rel, 1, gl.BYTE, false); attr(4, col, 3, gl.UNSIGNED_BYTE, true);
  gl.vertexAttrib1f(5, 1);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
}

// The cord's surface: a second, small mesh in the same vertex layout, rebuilt whenever the page is laid out.
const TUBE = 11; // floats per vertex: position(3) normal(3) colour(3) relief(1) fade(1)
function tubeSet(gl) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (const [loc, size, off] of [[0, 3, 0], [1, 3, 3], [4, 3, 6], [3, 1, 9], [5, 1, 10]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, TUBE * 4, off * 4); }
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bindVertexArray(null);
  return { vao, count: 0, set(v, i) { gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, i, gl.DYNAMIC_DRAW); gl.bindVertexArray(null); this.count = i.length; } };
}

const STRIDE = 12; // floats per line segment: a(3) b(3) s(2) colour(3) half-width(1)
function lineSet(gl) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (const [loc, size, off] of [[1, 3, 0], [2, 3, 3], [3, 2, 6], [4, 3, 8], [5, 1, 11]]) {
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, off * 4); gl.vertexAttribDivisor(loc, 1);
  }
  gl.bindVertexArray(null);
  return { vao, buf, count: 0, set(data) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); this.count = data.length / STRIDE; } };
}

// the standard tractography colour code: left-right red, front-back green, up-down blue
const dirCol = (a, b) => { const d = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])], m = Math.max(d[0], d[1], d[2]) || 1; return d.map(v => 0.08 + 0.92 * Math.pow(v / m, 0.9)); };

function buildTracts(tj, tb) {
  const N = tj.streamlines, P = tj.points, q = new Uint16Array(tb, 0, N * P * 3), flag = new Uint8Array(tb, N * P * 6 + N, N);
  const sc = [0, 1, 2].map(a => (tj.hi[a] - tj.lo[a]) / 65535);
  const pt = (i, j) => { const o = (i * P + j) * 3; return [tj.lo[0] + q[o] * sc[0], tj.lo[1] + q[o + 1] * sc[1], tj.lo[2] + q[o + 2] * sc[2]]; };
  const data = new Float32Array(N * (P - 1) * STRIDE), starts = [], pts = new Array(P), arc = new Float32Array(P), s = new Float32Array(P); let o = 0;
  for (let i = 0; i < N; i++) {
    let j0 = 0, d0 = 1e9;
    for (let j = 0; j < P; j++) {
      const p = pts[j] = pt(i, j); arc[j] = j ? arc[j - 1] + Math.hypot(p[0] - pts[j - 1][0], p[1] - pts[j - 1][1], p[2] - pts[j - 1][2]) : 0;
      const d = Math.hypot(p[0] - CENTRE[0], p[1] - CENTRE[1], p[2] - CENTRE[2]); if (d < d0) { d0 = d; j0 = j; }
    }
    // An impulse leaves the centre of the brain, joins this pathway at its deepest point and runs out along both arms.
    // s is its arrival time: 0 at the centre, 1 at each end of the pathway, so every pathway delivers to the surface together.
    for (let j = 0; j < P; j++) { const arm = Math.abs(arc[j] - arc[j0]), len = j <= j0 ? arc[j0] : arc[P - 1] - arc[j0]; s[j] = (d0 + arm) / (d0 + Math.max(len, 1e-3)); }
    for (let j = 0; j < P - 1; j++) {
      const a = pts[j], b = pts[j + 1], c = dirCol(pts[Math.max(0, j - 1)], pts[Math.min(P - 1, j + 2)]);
      data.set([a[0], a[1], a[2], b[0], b[1], b[2], s[j], s[j + 1], c[0], c[1], c[2], 1], o); o += STRIDE;
    }
    if (flag[i] & 2) {
      const a = pts[P - 3], b = pts[P - 1], dz = Math.max(0.5, a[2] - b[2]);
      starts.push({ p: b, tan: [clamp((b[0] - a[0]) / dz, -0.5, 0.5), clamp((b[1] - a[1]) / dz, -0.5, 0.5)] });
    }
  }
  return { data, starts };
}

/* The cord. Below the medulla the same surface and the same fibres carry on: the surface narrows the way the cord
   narrows into its terminal thread, the fibres end one by one, the colour drains to red, and what is left is the line. */
function cordShape() {
  const J = G.stemJ, Tp = G.stemTop, zEnd = ZC - (G.fieldH - G.yAnchor) / G.k, total = ZJ - zEnd;
  const U = Math.min(215, 0.62 * total), thr = 1.4 / G.k, span = ZREF - ZJ;
  const m0 = clamp((J.yc - G.stemJ2.yc) / 4, -0.3, 0.1) * 0.7;             // the brainstem's own backward slope, carried into the cord
  const yc = u => { if (u <= 0) return lerp(J.yc, Tp.yc, clamp(-u / span, 0, 1.4)); const t = clamp(u / U, 0, 1), t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * J.yc + (t3 - 2 * t2 + t) * U * m0 + (3 * t2 - 2 * t3) * YC; };
  const taper = u => Math.pow(1 - clamp((u - 26) / (U - 26), 0, 1), 1.35);
  const rad = (u, rJ, rTop, rCord) => u <= 0 ? lerp(rJ, rTop, clamp(-u / span, 0, 1.4)) : Math.max(thr, lerp(rJ, rCord, sstep(0, 34, u)) * taper(u));
  return { total, U, thr, yc, rx: u => rad(u, J.rx, Tp.rx, 6.3), ry: u => rad(u, J.ry, Tp.ry, 4.7), s: u => 1 + (u + ZREF - ZJ) / CORD_RATE };
}

function buildCord() {
  const st = G.cordStarts; if (!st || !st.length || !G.stemJ) return;
  const sh = G.shape = cordShape(), R = rng(5);
  // surface
  const ring = 28, du = 2.5, nr = Math.floor(sh.U / du) + 1, tv = new Float32Array(nr * ring * TUBE), ti = new Uint16Array((nr - 1) * ring * 6);
  for (let i = 0, o = 0; i < nr; i++) {
    const u = i * du, rx = sh.rx(u), ry = sh.ry(u), yc = sh.yc(u), red = sstep(8, 0.8 * sh.U, u), fade = 1 - sstep(sh.U - 80, sh.U - 8, u);
    for (let j = 0; j < ring; j++) {
      const a = j / ring * TAU, c = Math.cos(a), s = Math.sin(a), nx = c / rx, ny = s / ry, nl = Math.hypot(nx, ny);
      tv.set([rx * c, yc + ry * s, ZJ - u, nx / nl, ny / nl, 0, lerp(STEM[0], RED[0], red), lerp(STEM[1], RED[1], red), lerp(STEM[2], RED[2], red), 24, fade], (i * ring + j) * TUBE);
      if (i < nr - 1) { const a0 = i * ring + j, a1 = i * ring + (j + 1) % ring; ti.set([a0, a0 + ring, a1, a1, a0 + ring, a1 + ring], o); o += 6; }
    }
  }
  G.tube.set(tv, ti);
  // fibres: each one picks up exactly where a corticospinal, lemniscal or reticulospinal streamline ends
  const segs = [], n = Math.min(st.length, 460), dz = 2.5;
  for (let q = 0; q < n; q++) {
    const { p, tan } = st[Math.floor(q * st.length / n)], u0 = ZJ - p[2];
    let xi = p[0] / sh.rx(u0), eta = (p[1] - sh.yc(u0)) / sh.ry(u0); const l = Math.hypot(xi, eta); if (l > 0.8) { xi *= 0.8 / l; eta *= 0.8 / l; }
    const life = 44 + Math.pow(R(), 1.35) * Math.max(0, sh.U - u0 - 84);
    let prev = p, pd = 0;
    for (let d = dz; d <= life; d += dz) {
      const u = u0 + d, bl = sstep(0, 12, d);
      const pt = [lerp(p[0] + tan[0] * d, xi * sh.rx(u), bl), lerp(p[1] + tan[1] * d, sh.yc(u) + eta * sh.ry(u), bl), p[2] - d];
      const red = sstep(8, 0.8 * sh.U, u - dz / 2), c = dirCol(prev, pt), w = clamp((life - d + dz) / 34, 0, 1);
      if (w > 0.12) segs.push(prev[0], prev[1], prev[2], pt[0], pt[1], pt[2], 1 + pd / CORD_RATE, 1 + d / CORD_RATE, lerp(c[0], RED[0], red), lerp(c[1], RED[1], red), lerp(c[2], RED[2], red), w);
      prev = pt; pd = d;
    }
  }
  G.cordFib.set(new Float32Array(segs));
  // the thread: one line on the page's centre, which the CSS line below the heart takes over from
  const th = [], u0 = Math.max(0, sh.U - 110), steps = Math.ceil((sh.total - u0) / 3), hand = 80 / G.k;
  for (let i = 0; i < steps; i++) {
    const ua = lerp(u0, sh.total, i / steps), ub = lerp(u0, sh.total, (i + 1) / steps), um = (ua + ub) / 2;
    const a = 0.7 * sstep(sh.U - 100, sh.U - 14, um) * clamp((sh.total - um) / hand, 0, 1);
    th.push(0, sh.yc(ua), ZJ - ua, 0, sh.yc(ub), ZJ - ub, sh.s(ua), sh.s(ub), RED[0] * a, RED[1] * a, RED[2] * a, -3);
  }
  G.thread.set(new Float32Array(th));
  G.sEnd = sh.s(sh.total);
}

/* ---------- the brain's outline, for the shockwave to leave from ---------- */
const SDF_W = 224, SDF_H = 192;               // one texel per millimetre
function dt1(f, n, d, v, z) {                 // one-dimensional squared distance transform (Felzenszwalb and Huttenlocher)
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s; for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
}
function distanceTo(mask, w, h, want) {       // distance from every texel to the nearest texel where mask == want
  const m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1), g = new Float64Array(w * h), out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = mask[y * w + x] === want ? 0 : 1e12; dt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; dt1(f, w, d, v, z); for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]); }
  return out;
}
function outline(yaw) {
  const gl = sg; if (!G.ready) return;
  if (!G.fbo) {
    G.fboTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, G.fboTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, SDF_W, SDF_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    G.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, G.fboTex, 0);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo); gl.viewport(0, 0, SDF_W, SDF_H);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.colorMask(true, true, true, true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  const pr = G.silPr; gl.useProgram(pr.p);
  gl.uniform4f(pr.u.uView, Math.cos(yaw), Math.sin(yaw), 1, 0); gl.uniform2f(pr.u.uAnchor, SDF_W / 2 + 0.5, SDF_H / 2 - 11); gl.uniform2f(pr.u.uRes, SDF_W, SDF_H); gl.uniform1f(pr.u.uCutZ, ZJ + 9);
  gl.bindVertexArray(G.mesh.vao); gl.drawElements(gl.TRIANGLES, G.mesh.count, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
  const px = new Uint8Array(SDF_W * SDF_H * 4); gl.readPixels(0, 0, SDF_W, SDF_H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const mask = new Uint8Array(SDF_W * SDF_H);
  for (let y = 0; y < SDF_H; y++) for (let x = 0; x < SDF_W; x++) mask[(SDF_H - 1 - y) * SDF_W + x] = px[(y * SDF_W + x) * 4 + 3] > 127 ? 1 : 0;
  const out = distanceTo(mask, SDF_W, SDF_H, 1), inn = distanceTo(mask, SDF_W, SDF_H, 0);
  for (let i = 0; i < out.length; i++) out[i] -= inn[i];          // millimetres outside the brain's outline; negative inside it
  smokeField(out, SDF_W, SDF_H);
}

/* ---------- layout ---------- */
function layout() {
  const bodyTop = document.body.getBoundingClientRect().top;
  const W = mainEl.offsetWidth, H = home.offsetHeight;
  const k = Math.min(H * 0.62 / 154, W * 0.94 / 182, 4.6), cx = W / 2, yAnchor = Math.round(H * 0.47);
  const hr = heartEl.getBoundingClientRect(), hTop = hr.top - bodyTop;
  Object.assign(G, { W, H, k, cx, yAnchor, px: cx - 0.5 * k, py: yAnchor + (ZC - 4) * k, fieldH: Math.round(hTop + hr.height * 0.45) });
  G.box = [cx - (SDF_W / 2 + 0.5) * k, yAnchor - (SDF_H / 2 - 11) * k, SDF_W * k, SDF_H * k];   // the page rectangle the outline field covers
  nameEl.style.top = yAnchor + 'px';
  G.sc = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(7e6 / (W * G.fieldH)));
  stageC.width = Math.round(W * G.sc); stageC.height = Math.round(G.fieldH * G.sc);
  stageC.style.width = W + 'px'; stageC.style.height = G.fieldH + 'px';
  if (G.ready) buildCord();
  G.arrive = (G.sEnd || 5) / SPEED;                      // seconds from a beat to its impulse reaching the heart
  sizeSmoke(); sizeHeart();
  const lr = $('#last').getBoundingClientRect(), endY = lr.top - bodyTop + lr.height / 2 + 70;
  // the dot rides the line only where the line is straight: from the point the cord has settled onto the page's centre
  const straight = G.shape ? yAnchor + (ZC - ZJ + G.shape.U) * k : yAnchor + (ZC + 280) * k;
  G.yS = Math.min(straight, G.fieldH - 120);
  track.style.top = G.yS + 'px'; track.style.height = Math.max(0, endY - G.yS) + 'px';
  spine.style.top = (G.fieldH - 80) + 'px'; spine.style.height = Math.max(0, endY - G.fieldH + 80 + 160) + 'px';
}

/* ---------- draw ---------- */
const flash = a => { const d = a - TA; return d < 0 ? Math.exp(-d * d / 0.004) : Math.exp(-d / 0.32); };   // the cortex lights as the impulse reaches it
function drawStage(t, n, e) {
  const gl = sg; if (!G.ready) return;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, stageC.width, stageC.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true); gl.colorMask(true, true, true, true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const yaw = yawAt(t), wide = clamp(G.k / 3.7, 0.5, 1.25);
  const common = pr => { gl.useProgram(pr.p); gl.uniform4f(pr.u.uView, Math.cos(yaw), Math.sin(yaw), G.k, 0); gl.uniform2f(pr.u.uAnchor, G.cx, G.yAnchor); gl.uniform2f(pr.u.uRes, G.W, G.fieldH); };
  const heads = [0, 1, 2, 3].map(i => n - i < 0 ? -1 : (t - (n - i) * T) * SPEED);
  const amps = [0, 1, 2, 3].map(i => (n - i) % BURST_EVERY === 0 ? 1 : 0.42);
  const volley = (pr, amp, w, tail) => { gl.uniform4f(pr.u.uHead, heads[0], heads[1], heads[2], heads[3]); gl.uniform4f(pr.u.uAmp, amp[0], amp[1], amp[2], amp[3]); gl.uniform1f(pr.u.uPulseW, w); gl.uniform1f(pr.u.uTail, tail); };
  const few = G.W < 700 ? 0.6 : 1, nTr = Math.floor(G.nStream * few) * G.seg;

  const surface = () => {
    gl.uniform1f(G.meshPr.u.uCutZ, ZJ); gl.bindVertexArray(G.mesh.vao); gl.drawElements(gl.TRIANGLES, G.mesh.count, gl.UNSIGNED_INT, 0);
    gl.uniform1f(G.meshPr.u.uCutZ, -1e5); gl.bindVertexArray(G.tube.vao); gl.drawElements(gl.TRIANGLES, G.tube.count, gl.UNSIGNED_SHORT, 0);
  };
  const depthOnly = () => {
    common(G.meshPr); gl.uniform1f(G.meshPr.u.uBeat, e);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.colorMask(false, false, false, false); gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1); surface(); gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true);
  };

  // 1. the brain's outline goes into the stencil, so no fibre is ever drawn outside the surface that holds it
  gl.clearStencil(0); gl.stencilMask(0xff); gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.ALWAYS, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  depthOnly();
  gl.stencilFunc(gl.EQUAL, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); gl.clear(gl.DEPTH_BUFFER_BIT);

  // 2. fibres, lit and depth-sorted
  gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  common(G.fibPr); gl.uniform1f(G.fibPr.u.uHalo, 1.25); gl.uniform1f(G.fibPr.u.uWide, wide); gl.uniform1f(G.fibPr.u.uBeat, e);
  if (!NO_TRACTS) { volley(G.fibPr, amps, 0.06, 0.2); gl.bindVertexArray(G.tracts.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nTr); }
  volley(G.fibPr, [1, 1, 1, 1], 0.2, 0.5); gl.bindVertexArray(G.cordFib.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, G.cordFib.count);

  // 3. the impulse's own light, shining through from the depth of the brain
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
  common(G.linePr); gl.uniform1f(G.linePr.u.uWide, wide * 2.2); gl.uniform1f(G.linePr.u.uDepthFade, 1); gl.uniform1f(G.linePr.u.uGain, 0); gl.uniform1f(G.linePr.u.uPulseGain, 0.034);
  if (!NO_TRACTS && heads.some(h => h >= 0 && h < 1.6)) { volley(G.linePr, amps, 0.05, 0.13); gl.bindVertexArray(G.tracts.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nTr); }
  gl.disable(gl.STENCIL_TEST);

  // 4. the surface: cortex, cerebellum, brainstem and, in one piece with it, the cord
  gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
  depthOnly();                                                                  // depth only: hides the far side of the brain
  gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND);
  if (!NO_MESH) surface();

  // 5. the thread to the heart
  gl.disable(gl.DEPTH_TEST);
  common(G.linePr); gl.uniform1f(G.linePr.u.uGain, 1); gl.uniform1f(G.linePr.u.uPulseGain, 1.7); gl.uniform1f(G.linePr.u.uDepthFade, 0); volley(G.linePr, [1, 1, 1, 1], 0.42, 0.42);
  gl.bindVertexArray(G.thread.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, G.thread.count);
  gl.bindVertexArray(null); gl.depthMask(true);
}

/*__SMOKE__*/

/*__HEART__*/

let last = '', tick = 0;
function label() {
  const my = markerEl.getBoundingClientRect().top; let cur = 'Scroll';
  for (const s of secs) if (s.getBoundingClientRect().top <= my + 2) cur = s.dataset.label;
  if (cur !== last) { mlabel.textContent = cur; last = cur; }
}
function frame(now) {
  if (!reduce) requestAnimationFrame(frame);
  const t = reduce ? T * 0.03 : FROZEN != null ? 40 * T + BURST_DELAY + FROZEN : now / 1000;
  const sy = -document.body.getBoundingClientRect().top, vh = window.innerHeight;
  const n = Math.floor(t / T), a = t - n * T, big = b => b % BURST_EVERY === 0 ? 1 : 0.42;
  const e = reduce ? 0.3 : Math.min(1, big(n) * flash(a) + big(n - 1) * flash(a + T));
  if (sy < G.fieldH + 80) { drawStage(t, reduce ? -1 : n, e); if (!reduce && !NO_SMOKE) drawSmoke(t, n, sy); }
  if (sy + vh > G.fieldH - 500 && sy < G.fieldH + 600) drawHeart(t);          // the heart fires as each impulse arrives
  if ((tick++ & 7) === 0) label();
}

let lw = 0, lh = 0, rt;
function relayout() { lw = mainEl.offsetWidth; lh = home.offsetHeight; layout(); if (reduce) frame(0); }
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (mainEl.offsetWidth !== lw || Math.abs(home.offsetHeight - lh) > 90) relayout(); }, 180); });
addEventListener('load', relayout);
addEventListener('scroll', label, { passive: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
relayout();

(async () => {
  if (!sg) { console.warn('WebGL2 is not available: the stage is not drawn.'); return; }
  const get = async (u, kind, tries = 3) => { try { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u + ' ' + r.status); return await r[kind](); } catch (err) { if (tries <= 1) throw err; await new Promise(ok => setTimeout(ok, 500)); return get(u, kind, tries - 1); } };
  // The binary data is served as .bin by a normal web server. The preview host only serves text, so it carries a base64 copy.
  const b64 = async name => { const s = atob((await get(`data/${name}.b64.txt`, 'text')).trim()), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && Q.get('b64') == null;
  const bin = name => local ? get(`data/${name}.bin`, 'arrayBuffer') : b64(name).catch(() => get(`data/${name}.bin`, 'arrayBuffer'));
  const [bj, bb, tj, tb, hj, hb] = await Promise.all([get('data/brain.json', 'json'), bin('brain'), get('data/tracts.json', 'json'), bin('tracts'), get('data/heart.json', 'json'), bin('heart')]);
  initHeart(hj, hb);
  G.meshPr = program(sg, MESH_VS, MESH_FS); G.silPr = program(sg, MESH_VS, SIL_FS);
  G.fibPr = program(sg, FIBRE_VS, FIBRE_FS); G.linePr = program(sg, LINE_VS, LINE_FS);
  G.mesh = buildMesh(sg, bj, bb); G.tube = tubeSet(sg);
  const tr = buildTracts(tj, tb);
  G.tracts = lineSet(sg); G.tracts.set(tr.data);
  G.seg = tj.points - 1; G.nStream = tj.streamlines; G.cordStarts = tr.starts; G.cordFib = lineSet(sg); G.thread = lineSet(sg);
  G.ready = true; relayout();
  if (reduce) { frame(0); addEventListener('scroll', () => frame(0), { passive: true }); }
})().catch(err => console.error(err));
if (!reduce) requestAnimationFrame(frame);
