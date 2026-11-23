/* The brain: the cortex surface of the MNI ICBM 2009c MRI template in CerebrA lobe colours, the HCP-1065 tractography
   atlas inside it, and the spinal cord carrying on from the medulla. Nothing here is drawn by hand. */
import { PROJ, program, lineSet, tubeSet } from './gl.js';
import { decodeBrain, decodeTracts, stemFit } from './data.js';
import { buildTracts, STRIDE } from './tracts.js';
import { cordShape, buildCord, ZJ, ZREF, TUBE } from './cord.js';
import { signedDistance } from './outline.js';
import { T, SPEED, heads as headsAt, amps as ampsAt } from './clock.js';
import { clamp } from './util.js';

export const SDF_W = 224, SDF_H = 192;   // the outline field: one texel per millimetre

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

const REGION_COL = [[.8, .8, .8], [.24, .6, 1], [1, .8, .22], [.22, 1, .52], [1, .3, .42], [.18, .95, .9], [.92, .92, .96], [.72, .45, 1], [1, .58, .22]];
// unlabelled, frontal, parietal, temporal, occipital, limbic, insula, cerebellum, brainstem

// Everything that depends only on the files, worked out once and kept, so a lost WebGL context can be rebuilt quickly.
export function prepareBrain(data) {
  const m = decodeBrain(data.brain.json, data.brain.buf), col = new Uint8Array(m.nv * 3);
  for (let i = 0; i < m.nv; i++) for (let a = 0; a < 3; a++) col[i * 3 + a] = Math.round(REGION_COL[m.region[i]][a] * 255);
  const fit = { stemTop: stemFit(m.pos, m.region, ZREF, 1.6), stemJ: stemFit(m.pos, m.region, ZJ, 1.3), stemJ2: stemFit(m.pos, m.region, ZJ + 4, 1.3) };
  const tr = buildTracts(decodeTracts(data.tracts.json, data.tracts.buf));
  return { m, col, fit, tracts: tr.data, starts: tr.starts, seg: data.tracts.json.points - 1, nStream: data.tracts.json.streamlines, lite: !!data.tracts.json.lite_of };
}

export function createBrain(canvas, prep, { preserve = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, stencil: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const { m, col, fit } = prep;
  const meshPr = program(gl, MESH_VS, MESH_FS), silPr = program(gl, MESH_VS, SIL_FS), fibPr = program(gl, FIBRE_VS, FIBRE_FS), linePr = program(gl, LINE_VS, LINE_FS);
  const mesh = gl.createVertexArray(); gl.bindVertexArray(mesh);
  const attr = (loc, d, size, type, norm) => { gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr(0, m.pos, 3, gl.FLOAT, false); attr(1, m.nrm, 3, gl.BYTE, true); attr(2, m.depth, 1, gl.UNSIGNED_BYTE, false); attr(3, m.relief, 1, gl.BYTE, false); attr(4, col, 3, gl.UNSIGNED_BYTE, true);
  gl.vertexAttrib1f(5, 1);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.index, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const meshCount = m.index.length, tube = tubeSet(gl, TUBE), tracts = lineSet(gl, STRIDE), cordFib = lineSet(gl, STRIDE), thread = lineSet(gl, STRIDE);
  tracts.set(prep.tracts);
  let G = null, fbo = null;

  const B = {
    gl, fit,
    layout(geom) {
      G = geom;
      canvas.width = Math.round(G.W * G.sc); canvas.height = Math.round(G.fieldH * G.sc);
      canvas.style.width = G.W + 'px'; canvas.style.height = G.fieldH + 'px';
      const shape = cordShape({ ...fit, fieldH: G.fieldH, yAnchor: G.yAnchor, k: G.k }), c = buildCord(shape, prep.starts);
      tube.set(c.tube.verts, c.tube.index); cordFib.set(c.fibres); thread.set(c.thread);
      return { shape, sEnd: c.sEnd };
    },
    // the brain's silhouette as it is turned now, as millimetres from its outline (positive outside)
    outline(yaw) {
      if (!fbo) {
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, SDF_W, SDF_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, SDF_W, SDF_H);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.colorMask(true, true, true, true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(silPr.p);
      gl.uniform4f(silPr.u.uView, Math.cos(yaw), Math.sin(yaw), 1, 0); gl.uniform2f(silPr.u.uAnchor, SDF_W / 2 + 0.5, SDF_H / 2 - 11); gl.uniform2f(silPr.u.uRes, SDF_W, SDF_H); gl.uniform1f(silPr.u.uCutZ, ZJ + 9);
      gl.bindVertexArray(mesh); gl.drawElements(gl.TRIANGLES, meshCount, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
      const px = new Uint8Array(SDF_W * SDF_H * 4); gl.readPixels(0, 0, SDF_W, SDF_H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const mask = new Uint8Array(SDF_W * SDF_H);
      for (let y = 0; y < SDF_H; y++) for (let x = 0; x < SDF_W; x++) mask[(SDF_H - 1 - y) * SDF_W + x] = px[(y * SDF_W + x) * 4 + 3] > 127 ? 1 : 0;
      return signedDistance(mask, SDF_W, SDF_H);
    },
    draw(t, n, e, yaw, { noMesh = false, noTracts = false } = {}) {
      if (!G) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true); gl.colorMask(true, true, true, true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const wide = clamp(G.k / 3.7, 0.5, 1.25);
      const common = pr => { gl.useProgram(pr.p); gl.uniform4f(pr.u.uView, Math.cos(yaw), Math.sin(yaw), G.k, 0); gl.uniform2f(pr.u.uAnchor, G.cx, G.yAnchor); gl.uniform2f(pr.u.uRes, G.W, G.fieldH); };
      const heads = headsAt(t, n), amps = ampsAt(n);
      const volley = (pr, amp, w, tail) => { gl.uniform4f(pr.u.uHead, heads[0], heads[1], heads[2], heads[3]); gl.uniform4f(pr.u.uAmp, amp[0], amp[1], amp[2], amp[3]); gl.uniform1f(pr.u.uPulseW, w); gl.uniform1f(pr.u.uTail, tail); };
      const few = G.W < 700 && !prep.lite ? 0.6 : 1, nTr = Math.floor(prep.nStream * few) * prep.seg;
      const surface = () => {
        gl.uniform1f(meshPr.u.uCutZ, ZJ); gl.bindVertexArray(mesh); gl.drawElements(gl.TRIANGLES, meshCount, gl.UNSIGNED_INT, 0);
        gl.uniform1f(meshPr.u.uCutZ, -1e5); gl.bindVertexArray(tube.vao); gl.drawElements(gl.TRIANGLES, tube.count, gl.UNSIGNED_SHORT, 0);
      };
      const depthOnly = () => {
        common(meshPr); gl.uniform1f(meshPr.u.uBeat, e);
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
      common(fibPr); gl.uniform1f(fibPr.u.uHalo, 1.25); gl.uniform1f(fibPr.u.uWide, wide); gl.uniform1f(fibPr.u.uBeat, e);
      if (!noTracts) { volley(fibPr, amps, 0.06, 0.2); gl.bindVertexArray(tracts.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nTr); }
      volley(fibPr, [1, 1, 1, 1], 0.2, 0.5); gl.bindVertexArray(cordFib.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cordFib.count);
      // 3. the impulse's own light, shining through from the depth of the brain
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      common(linePr); gl.uniform1f(linePr.u.uWide, wide * 2.2); gl.uniform1f(linePr.u.uDepthFade, 1); gl.uniform1f(linePr.u.uGain, 0); gl.uniform1f(linePr.u.uPulseGain, 0.034);
      if (!noTracts && heads.some(h => h >= 0 && h < 1.6)) { volley(linePr, amps, 0.05, 0.13); gl.bindVertexArray(tracts.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nTr); }
      gl.disable(gl.STENCIL_TEST);
      // 4. the surface: cortex, cerebellum, brainstem and, in one piece with it, the cord
      gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
      depthOnly();                                                              // depth only: hides the far side of the brain
      gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND);
      if (!noMesh) surface();
      // 5. the thread to the heart
      gl.disable(gl.DEPTH_TEST);
      common(linePr); gl.uniform1f(linePr.u.uGain, 1); gl.uniform1f(linePr.u.uPulseGain, 1.7); gl.uniform1f(linePr.u.uDepthFade, 0); volley(linePr, [1, 1, 1, 1], 0.42, 0.42);
      gl.bindVertexArray(thread.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, thread.count);
      gl.bindVertexArray(null); gl.depthMask(true);
    },
  };
  return B;
}
export { T, SPEED };
