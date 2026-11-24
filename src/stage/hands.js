/* The hands on Clinical Experience: the Smithsonian's scans of the plaster casts of Abraham Lincoln's hands, drawn
   as a graphite engraving on black. The right hand, a fist round a cut broom handle, reaches down; the left reaches up,
   palm open. Both drift and turn slowly (handpose.js), and red strings, simulated as ropes (ropes.js), run between
   fixed points on their knuckles and fingertips, slackening and pulling taut as the hands move.
   Millimetres, +y up, +z towards the viewer. */
import { program } from './gl.js';
import { handPose } from './handpose.js';
import { createRope, stepRope, ropePoints } from './ropes.js';

const CAMERA = 640, NEAR = 40, FAR = 2000, SEG = 16, STEP = 1 / 60;

const CAM = `
uniform vec2 uTan;
vec4 camera(vec3 p){ float zc = p.z - ${CAMERA}.; return vec4(p.x/uTan.x, p.y/uTan.y, (-zc*(${FAR}.+${NEAR}.) - 2.*${FAR}.*${NEAR}.)/(${FAR}.-${NEAR}.), -zc); }`;

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
  gl_Position = vec4((e.xy/e.w*uRes + across*aCorner.y*uWidth)/uRes*e.w, e.z, e.w);
  vDepth = mix(aA.z, aB.z, aCorner.x);
}`;
const STRING_FS = `#version 300 es
precision highp float;
in float vDepth;
out vec4 o;
void main(){ float k = clamp(.72 + vDepth/220., .5, 1.); o = vec4(vec3(1., .137, .22)*k, 1.); }`;

const apply = (m, p, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2] + p[0], m[1] * v[0] + m[4] * v[1] + m[7] * v[2] + p[1], m[2] * v[0] + m[5] * v[1] + m[8] * v[2] + p[2]];

export function createHands(canvas, mesh, json, { preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const hand = program(gl, HAND_VS, HAND_FS), str = program(gl, STRING_VS, STRING_FS);
  if (!hand || !str) return null;

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (name, data, size, type, norm) => { const loc = hand.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr('aPos', mesh.pos, 3, gl.FLOAT, false); attr('aNrm', mesh.nrm, 3, gl.BYTE, true); attr('aHand', mesh.hand, 1, gl.UNSIGNED_BYTE, false);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);

  // strings: one instanced quad per rope segment, its two ends refreshed every frame
  const anchors = json.anchors, strings = json.strings, nSeg = strings.length * SEG;
  const seg = new Float32Array(nSeg * 6), svao = gl.createVertexArray(); gl.bindVertexArray(svao);
  const cl = str.a('aCorner'), al = str.a('aA'), bl = str.a('aB');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
  const sbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sbuf); gl.bufferData(gl.ARRAY_BUFFER, seg, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(al, 1);
  gl.enableVertexAttribArray(bl); gl.vertexAttribPointer(bl, 3, gl.FLOAT, false, 24, 12); gl.vertexAttribDivisor(bl, 1);
  gl.bindVertexArray(null);

  const ends = pose => strings.map(([a, b]) => [apply(pose[anchors[a].hand].m, pose[anchors[a].hand].p, anchors[a].p), apply(pose[anchors[b].hand].m, pose[anchors[b].hand].p, anchors[b].p)]);
  // each string is as long as the farthest its two anchors ever get, plus a little: never overstretched, often slack
  const reach = strings.map(() => 0);
  for (let t = 0; t < 60; t += 0.25) ends(handPose(t)).forEach(([a, b], i) => { reach[i] = Math.max(reach[i], Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); });
  let ropes = null, simT = null;
  const start = pose => {
    ropes = ends(pose).map(([a, b], i) => { const r = createRope(a, b, SEG, 0); r.len = reach[i] * 1.04 / SEG; return r; });
    const e = ends(pose); for (let k = 0; k < 240; k++) ropes.forEach((r, i) => stepRope(r, e[i][0], e[i][1], STEP));   // let them hang first
  };

  let w = 0, h = 0, tanX = 1, tanY = 1;
  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const s = Math.min(dpr, Math.sqrt(7e6 / Math.max(1, r.width * r.height)));
      w = r.width; h = r.height;
      const W = Math.max(2, Math.round(w * s)), H = Math.max(2, Math.round(h * s));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      tanY = 160 / CAMERA; tanX = tanY * w / h;                            // about 320 mm of height in view: the wrists leave the frame
      if (tanX * CAMERA < 120) { tanX = 120 / CAMERA; tanY = tanX * h / w; }   // a narrow screen: keep both hands' width
    },
    draw(t, fixed = {}) {
      const time = fixed.age != null ? fixed.age : t, pose = handPose(time);
      if (!ropes) { start(pose); simT = time; }
      if (fixed.age != null) simT = time;
      else {                                                                // fixed steps, however fast the frames come
        if (time - simT > 0.5) simT = time - 0.5;
        while (simT + STEP <= time) { simT += STEP; const e = ends(handPose(simT)); ropes.forEach((r, i) => stepRope(r, e[i][0], e[i][1], STEP)); }
      }
      ropes.forEach((r, i) => { const P = ropePoints(r); for (let k = 0; k < SEG; k++) seg.set(P.subarray(k * 3, k * 3 + 6), (i * SEG + k) * 6); });

      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(hand.p); gl.bindVertexArray(vao);
      const u = hand.u;
      gl.uniform2f(u.uTan, tanX, tanY);
      gl.uniformMatrix3fv(u.uM0, false, pose[0].m); gl.uniformMatrix3fv(u.uM1, false, pose[1].m); gl.uniform3fv(u.uP0, pose[0].p); gl.uniform3fv(u.uP1, pose[1].p);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
      gl.uniform1f(u.uFreq, Math.min(0.95, Math.max(0.2, canvas.height / 2 / (tanY * CAMERA) / 4.2)));   // device px per mm, over 4.2 px a line
      gl.uniform1f(u.uPass, 0); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthFunc(gl.LEQUAL);
      gl.uniform1f(u.uPass, 1); gl.drawElements(gl.TRIANGLES, mesh.index.length, gl.UNSIGNED_INT, 0);

      gl.useProgram(str.p); gl.bindVertexArray(svao);
      gl.bindBuffer(gl.ARRAY_BUFFER, sbuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, seg);
      gl.uniform2f(str.u.uTan, tanX, tanY); gl.uniform2f(str.u.uRes, canvas.width / 2, canvas.height / 2);
      gl.uniform1f(str.u.uWidth, Math.min(1.5, 0.75 * canvas.width / Math.max(1, w)));
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nSeg);
      gl.bindVertexArray(null);
    },
  };
}
