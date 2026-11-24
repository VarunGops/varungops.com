/* The hands on Clinical Experience: the Smithsonian's scans of the plaster casts of Abraham Lincoln's hands, drawn
   as a graphite engraving on black. The right hand, a fist round a cut broom handle, reaches down; the left reaches up,
   palm open. Both drift and turn slowly (handpose.js). Between them they hold red strings, simulated as ropes (ropes.js),
   that slacken and tighten as the hands move; from the same knuckles and fingertips more strings run out taut and
   straight across the whole screen, as in the reference drawing. Behind the words the strings fade almost away, and
   they fade out as the hands scroll off.
   Millimetres, +y up, +z towards the viewer. The canvas covers the screen; the hands sit in their box on the page. */
import { program } from './gl.js';
import { handPose, rayOut } from './handpose.js';
import { createRope, stepRope, ropePoints, catchUp } from './ropes.js';

const CAMERA = 640, NEAR = 40, FAR = 4000, SEG = 24, STEP = 1 / 60;

// the camera, with the hands' box placed wherever it sits on the screen: uScale is box over screen, uOff its centre
const CAM = `
uniform vec2 uTan, uScale, uOff;
vec4 camera(vec3 p){
  float w = ${CAMERA}. - p.z;
  return vec4(p.x/uTan.x*uScale.x + uOff.x*w, p.y/uTan.y*uScale.y + uOff.y*w, (w*(${FAR}.+${NEAR}.) - 2.*${FAR}.*${NEAR}.)/(${FAR}.-${NEAR}.), w);
}`;

const HAND_VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in float aHand;
uniform mat3 uM0, uM1; uniform vec3 uP0, uP1;
${CAM}
out vec3 vN; out vec3 vObj; out vec3 vW;
void main(){
  bool up = aHand < .5;
  vec3 p = (up ? uM0 : uM1)*aPos + (up ? uP0 : uP1);
  vN = (up ? uM0 : uM1)*aNrm; vObj = aPos; vW = p;
  gl_Position = camera(p);
}`;
// the heart's engraving, in graphite: lines ring each hand along its length, swell in the light and thin to nothing in
// shadow, with a crossing set in full light and a soft rim; a first pass draws the hands solid black for depth
const HAND_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vObj; in vec3 vW;
uniform float uPass, uFreq;     // uFreq: engraved lines per mm, set so each line is about 4 pixels apart
out vec4 o;
void main(){
  if (uPass < .5) { o = vec4(0., 0., 0., 1.); return; }
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vec3(-vW.x, -vW.y, ${CAMERA}. - vW.z));
  float ndl = clamp(dot(n, normalize(vec3(-.45, .55, .7))), 0., 1.), rim = pow(1. - clamp(dot(n, v), 0., 1.), 2.4);
  float coord = (vObj.y + vObj.x*.19)*uFreq, f = abs(fract(coord) - .5)*2., w = fwidth(coord)*1.5;
  float line = 1. - smoothstep(mix(.04, .55, ndl*ndl) - w, mix(.04, .55, ndl*ndl) + w, f);
  float c2 = dot(vObj, normalize(vec3(.7, .35, .6)))*uFreq*1.15, f2 = abs(fract(c2) - .5)*2., w2 = fwidth(c2)*1.5;
  float hatch = (1. - smoothstep(.14 - w2, .14 + w2, f2))*smoothstep(.62, .92, ndl);
  float I = max(line, hatch*.65)*(.2 + .8*ndl) + rim*.42;
  o = vec4(vec3(.82, .82, .85)*I, 1.);
}`;

const STRING_VS = `#version 300 es
in vec2 aCorner; in vec3 aA; in vec3 aB;
uniform vec2 uRes; uniform float uWidth;
${CAM}
out float vDepth;
void main(){
  vec4 a = camera(aA), b = camera(aB);
  vec2 sa = a.xy/a.w*uRes, sb = b.xy/b.w*uRes, along = normalize(sb - sa + 1e-6), across = vec2(-along.y, along.x);
  vec4 e = mix(a, b, aCorner.x);
  gl_Position = vec4((e.xy/e.w*uRes + across*aCorner.y*uWidth*clamp(${CAMERA - 100}./e.w, .7, 1.8))/uRes*e.w, e.z, e.w);   // nearer: wider
  vDepth = mix(aA.z, aB.z, aCorner.x);
}`;
const STRING_FS = `#version 300 es
precision highp float;
in float vDepth;
uniform float uFade; uniform vec4 uText;      // the words' box, in window pixels from the bottom left
out vec4 o;
void main(){
  vec2 mid = (uText.xy + uText.zw)*.5, h = (uText.zw - uText.xy)*.5, q = abs(gl_FragCoord.xy - mid) - h + 90.;
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - 90.;                 // a soft, rounded fade behind the words
  float k = clamp(.72 + vDepth/260., .45, 1.)*smoothstep(-60., 240., d)*uFade;
  vec3 c = vec3(1., .137, .22)*k;
  o = vec4(c, k);
}`;

const apply = (m, p, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2] + p[0], m[1] * v[0] + m[4] * v[1] + m[7] * v[2] + p[1], m[2] * v[0] + m[5] * v[1] + m[8] * v[2] + p[2]];

export function createHands(canvas, mesh, json, { preserve = false, box = canvas } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const hand = program(gl, HAND_VS, HAND_FS), str = program(gl, STRING_VS, STRING_FS);
  if (!hand || !str) return null;

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (name, data, size, type, norm) => { const loc = hand.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr('aPos', mesh.pos, 3, gl.FLOAT, false); attr('aNrm', mesh.nrm, 3, gl.BYTE, true); attr('aHand', mesh.hand, 1, gl.UNSIGNED_BYTE, false);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

  // strings: one instanced quad per piece, refreshed every frame — the rope segments held between the hands, then one
  // taut ray out from every anchor
  const strings = json.strings;
  // each string is tied just inside the finger it rests on, so the finger hides where it is held
  const mid = [0, 1].map(h => { const A = json.anchors.filter(a => a.hand === h); return [0, 1, 2].map(k => A.reduce((s, a) => s + a.p[k], 0) / A.length); });
  const anchors = json.anchors.map(a => { const d = mid[a.hand].map((v, k) => v - a.p[k]), n = Math.hypot(...d) || 1; return { ...a, p: a.p.map((v, k) => v + d[k] / n * 2.5) }; });
  // the strings that run out across the screen start from the four anchors on each hand that lie farthest to its sides
  const outward = [0, 1].flatMap(h => anchors.map((a, k) => ({ k, h, side: Math.abs(a.p[0] - mid[h][0]) })).filter(o => o.h === h).sort((x, y) => y.side - x.side).slice(0, 4).map(o => o.k));
  const nRope = strings.length * SEG, nStr = nRope + outward.length;
  const seg = new Float32Array(nStr * 6), svao = gl.createVertexArray(); gl.bindVertexArray(svao);
  const cl = str.a('aCorner'), al = str.a('aA'), bl = str.a('aB');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
  const sbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sbuf); gl.bufferData(gl.ARRAY_BUFFER, seg, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(al, 1);
  gl.enableVertexAttribArray(bl); gl.vertexAttribPointer(bl, 3, gl.FLOAT, false, 24, 12); gl.vertexAttribDivisor(bl, 1);
  gl.bindVertexArray(null);
  const at = (pose, k) => apply(pose[anchors[k].hand].m, pose[anchors[k].hand].p, anchors[k].p);
  const words = document.querySelector('.side-body');

  // the held strings: each as long as the farthest its anchors ever get, plus a little, so it is never overstretched
  const ends = pose => strings.map(([a, b]) => [at(pose, a), at(pose, b)]);
  const reach = strings.map(() => 0);
  for (let t = 0; t < 60; t += 0.25) ends(handPose(t)).forEach(([a, b], i) => { reach[i] = Math.max(reach[i], Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); });
  let ropes = null, simT = null;
  const hang = pose => {
    ropes = ends(pose).map(([a, b], i) => { const r = createRope(a, b, SEG, 0); r.len = reach[i] * 1.02 / SEG; return r; });
    const e = ends(pose); for (let k = 0; k < 240; k++) ropes.forEach((r, i) => stepRope(r, e[i][0], e[i][1], STEP));
  };
  // the strings that run out: from each anchor, away from the middle of its own hand's anchors, leaning away from the
  // other hand, so they fan out across the screen from the knuckles and fingertips
  const away = anchors.map(a => { const o = a.p.map((v, k) => v - mid[a.hand][k]), n = Math.hypot(o[0], o[1]) || 1; return [o[0] / n, o[1] / n, 0.25 * o[2] / n]; });
  const rotate = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];

  let vw = 0, vh = 0, sc = 1, tanX = 1, tanY = 1;
  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = r.width; vh = r.height; sc = Math.min(dpr, Math.sqrt(7e6 / Math.max(1, vw * vh)));
      const W = Math.max(2, Math.round(vw * sc)), H = Math.max(2, Math.round(vh * sc));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const b = box.getBoundingClientRect();
      tanY = 186 / CAMERA; tanX = tanY * b.width / Math.max(1, b.height);    // about 320 mm of height in the box: the wrists leave it
      if (tanX * CAMERA < 120) { tanX = 120 / CAMERA; tanY = tanX * b.height / Math.max(1, b.width); }   // a narrow box: keep both hands' width
    },
    clear() { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
    draw(t, fixed = {}) {
      const time = fixed.age != null ? fixed.age : t, pose = handPose(time);
      const c = catchUp(ropes ? simT : null, time);
      if (c.rehang) hang(pose);
      simT = c.from;
      if (fixed.age == null) while (simT + STEP <= time) { simT += STEP; const e = ends(handPose(simT)); ropes.forEach((r, i) => stepRope(r, e[i][0], e[i][1], STEP)); }
      ropes.forEach((r, i) => { const P = ropePoints(r); for (let k = 0; k < SEG; k++) seg.set(P.subarray(k * 3, k * 3 + 6), (i * SEG + k) * 6); });
      outward.forEach((k, j) => {
        const a = anchors[k], w = rotate(pose[a.hand].m, away[k]), lean = a.hand === 0 ? 0.55 : -0.55;
        const [p, q] = rayOut(at(pose, k), [w[0], w[1] + lean, Math.max(-0.12, Math.min(0.12, w[2]))], { reach: 3000, zNear: CAMERA - 90, zFar: -3000 });   // kept nearly flat, so every one reaches the edge of the screen
        seg.set(p, (nRope + j) * 6); seg.set(q, (nRope + j) * 6 + 3);
      });
      const b = box.getBoundingClientRect(), wr = words ? words.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
      const cam = pr => { gl.uniform2f(pr.u.uTan, tanX, tanY); gl.uniform2f(pr.u.uScale, b.width / vw, b.height / vh); gl.uniform2f(pr.u.uOff, (b.left + b.width / 2) / vw * 2 - 1, 1 - (b.top + b.height / 2) / vh * 2); };

      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(hand.p); gl.bindVertexArray(vao);
      const u = hand.u;
      cam(hand);
      gl.uniformMatrix3fv(u.uM0, false, pose[0].m); gl.uniformMatrix3fv(u.uM1, false, pose[1].m); gl.uniform3fv(u.uP0, pose[0].p); gl.uniform3fv(u.uP1, pose[1].p);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
      gl.uniform1f(u.uFreq, Math.min(0.95, Math.max(0.2, b.height * sc / 2 / (tanY * CAMERA) / (sc > 1.5 ? 6.5 : 4.2))));   // device px per mm, over 4.2 px a line
      gl.uniform1f(u.uPass, 0); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthFunc(gl.LEQUAL);
      gl.uniform1f(u.uPass, 1); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);

      gl.useProgram(str.p); gl.bindVertexArray(svao);
      gl.bindBuffer(gl.ARRAY_BUFFER, sbuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, seg);
      cam(str); gl.uniform2f(str.u.uRes, canvas.width / 2, canvas.height / 2);
      gl.uniform1f(str.u.uWidth, Math.min(1.4, 0.7 * sc));
      gl.uniform1f(str.u.uFade, Math.max(0, Math.min(1, (b.bottom + 0.1 * vh) / (0.5 * vh))));
      gl.uniform4f(str.u.uText, wr.left * sc, (vh - wr.bottom) * sc, wr.right * sc, (vh - wr.top) * sc);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nStr);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
  };
}
