/* ---------- the heart (WebGL): a real anatomical model, drawn as a red engraving on black, beating ----------
   Atria, great vessels, coronary arteries and cardiac veins are BodyParts3D meshes. The outer ventricular surface is
   rebuilt from the model's ventricular cavities and coronary arteries (see prep/prep_heart.py). */
const heartC = $('#heart');
const hgl = heartC.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
const HT = { ok: false };
const HEART_VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in float aCls;
uniform mat3 uRot; uniform vec2 uRes, uOff; uniform float uScale;
uniform vec3 uBase, uAxis, uApex, uSA; uniform float uVent, uAtr, uAge;
out vec3 vN; out vec3 vP; out float vCls; out float vGlow; out float vFade;
void main(){
  vec3 p = aPos;
  float h = dot(p - uBase, uAxis);                       // mm along the long axis, from the base towards the apex
  vec3 onAxis = uBase + uAxis*h, radial = p - onAxis;
  bool vent = aCls < .5 || aCls > 5.5, atr = abs(aCls - 1.) < .5; // the coronary vessels ride on the ventricular wall
  float glow = 0.;
  if (vent) {                                            // systole: the wall moves in, the apex twists, the base is drawn down
    float c = uVent*smoothstep(-8., 24., h), ang = .12*c*smoothstep(10., 95., h);
    vec3 r = radial*cos(ang) + cross(uAxis, radial)*sin(ang);
    p = onAxis + r*(1. - .10*c) + uAxis*(3.5*uVent*(1. - smoothstep(0., 60., h)));
    glow = exp(-pow((uAge - (.26 + distance(aPos, uApex)/420.))/.07, 2.));   // activation spreads up from the apex
  } else if (atr) {
    p = uBase + (p - uBase)*(1. - .05*uAtr) + uAxis*(2.1*uVent);
    glow = exp(-pow((uAge - distance(aPos, uSA)/520.)/.06, 2.));             // and across the atria from the sinoatrial node
  }
  vec3 v = uRot*p;
  gl_Position = vec4((uOff.x + v.x*uScale)/uRes.x*2. - 1., 1. - (uOff.y - v.y*uScale)/uRes.y*2., -v.z/400., 1.);
  vN = uRot*aNrm; vP = aPos; vCls = aCls; vGlow = glow;
  vFade = 1. - smoothstep(62., 92., length((aPos - vec3(0., 0., 10.))*vec3(1.05, .5, 1.)));  // vessels fade out as they leave the heart
}`;
const HEART_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vP; in float vCls; in float vGlow; in float vFade;
uniform vec3 uBase, uAxis; uniform float uPass, uBeat;
out vec4 o;
void main(){
  if (vFade < .02) discard;
  if (uPass < .5) { o = vec4(0., 0., 0., 1.); return; }  // first pass: the heart is solid, so the line passes behind it
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float ndl = clamp(dot(n, normalize(vec3(-.5, .55, .68))), 0., 1.);
  float rim = pow(1. - clamp(n.z, 0., 1.), 2.2), I;
  vec3 col = vec3(1., .14, .2);
  if (vCls > 6.5) { I = .16 + .3*ndl + .3*rim; col = vec3(.8, .08, .2); }               // cardiac veins: quieter
  else if (vCls > 5.5) { I = .45 + .75*ndl + .45*rim; col = vec3(1., .24, .25); }       // coronary arteries: the brightest line work
  else {
    bool vessel = vCls > 1.5;
    float coord = vessel ? vP.z*.42 : dot(vP - uBase, uAxis)*.46;   // lines ring the great vessels, and ring the heart round its long axis
    float f = abs(fract(coord) - .5)*2., w = fwidth(coord)*1.6;
    float thick = mix(.05, .58, ndl*ndl);                           // the engraver's line swells in the light and thins to nothing in shadow
    float line = 1. - smoothstep(thick - w, thick + w, f);
    float f2 = abs(fract(dot(vP, normalize(cross(uAxis, vec3(0., 1., 0.))))*.46) - .5)*2.;
    float hatch = (1. - smoothstep(.12 - w, .12 + w, f2))*smoothstep(.7, .95, ndl);   // a crossing set, only in full light
    I = max(line, hatch*.7)*(.25 + .75*ndl) + rim*.6;
    if (vessel) I *= .8;
  }
  I = I*(.85 + .25*uBeat) + vGlow*(.3 + .9*I);
  col = mix(col, vec3(1., .6, .52), clamp(vGlow*.8, 0., 1.));
  o = vec4(col*I*vFade, 0.);
}`;
function initHeart(hj, hb) {
  if (!hgl) return;
  const gl = hgl, nv = hj.verts, q = new Uint16Array(hb, 0, nv * 3), n8 = new Int8Array(hb, nv * 6, nv * 3), cls = new Uint8Array(hb, nv * 9, nv);
  const idx = new Uint32Array(hb, Math.ceil(nv * 10 / 4) * 4, hj.faces * 3), pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = hj.lo[a] + q[i * 3 + a] / 65535 * (hj.hi[a] - hj.lo[a]);
  const pr = program(gl, HEART_VS, HEART_FS), vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (name, data, size, type, norm) => { const loc = pr.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr('aPos', pos, 3, gl.FLOAT, false); attr('aNrm', n8, 3, gl.BYTE, true); attr('aCls', cls, 1, gl.UNSIGNED_BYTE, false);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); gl.bindVertexArray(null);
  Object.assign(HT, { pr, vao, count: idx.length, j: hj, ok: true });
  sizeHeart();
}
function sizeHeart() {
  if (!hgl) return;
  const r = heartC.getBoundingClientRect(), s = Math.min(window.devicePixelRatio || 1, 2);
  HT.w = r.width; HT.h = r.height;
  const W = Math.max(2, Math.round(r.width * s)), H = Math.max(2, Math.round(r.height * s));
  if (heartC.width !== W || heartC.height !== H) { heartC.width = W; heartC.height = H; }
}
function drawHeart(t) {
  if (!HT.ok) return;
  const gl = hgl, u = HT.pr.u, j = HT.j;
  const age = HEART_AGE != null ? HEART_AGE : reduce ? 0.9 : (((t - G.arrive) % T) + T) % T;     // seconds since the impulse from the brain arrived
  const atr = Math.exp(-Math.pow((age - 0.12) / 0.07, 2)), vent = sstep(0.2, 0.36, age) * (1 - sstep(0.42, 0.72, age));
  const phi = HEART_YAW != null ? HEART_YAW : reduce ? 0.1 : 0.1 + 0.2 * Math.sin(t * 0.33), c = Math.cos(phi), s = Math.sin(phi);
  const scale = HT.h / 168;
  gl.viewport(0, 0, heartC.width, heartC.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(HT.pr.p); gl.bindVertexArray(HT.vao);
  gl.uniformMatrix3fv(u.uRot, false, [c, 0, -s, -s, 0, -c, 0, 1, 0]);  // anterior view (patient's left on the right of the screen), swaying a little
  gl.uniform2f(u.uRes, HT.w, HT.h); gl.uniform2f(u.uOff, HT.w / 2 - 6 * scale, HT.h * 0.5 + 12 * scale); gl.uniform1f(u.uScale, scale);
  gl.uniform3fv(u.uBase, j.base); gl.uniform3fv(u.uAxis, j.axis); gl.uniform3fv(u.uApex, j.apex); gl.uniform3fv(u.uSA, j.sa);
  gl.uniform1f(u.uVent, vent); gl.uniform1f(u.uAtr, atr); gl.uniform1f(u.uAge, age); gl.uniform1f(u.uBeat, Math.max(atr * 0.6, vent));
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
  gl.uniform1f(u.uPass, 0); gl.drawElements(gl.TRIANGLES, HT.count, gl.UNSIGNED_INT, 0);
  gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.uniform1f(u.uPass, 1); gl.drawElements(gl.TRIANGLES, HT.count, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
