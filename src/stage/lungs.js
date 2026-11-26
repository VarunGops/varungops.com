/* The lungs on Life: the Human Reference Atlas lungs (Visible Human Female), drawn front-on as a red engraving like
   the heart, breathing at rest (breath.js). Lines ring the lungs across, swelling in the light and thinning to
   nothing in shadow, with a crossing set only in full light; the bronchi show through as finer, brighter lines.
   Drawn on a full-screen canvas (behind the words, like the hands) and fitted to its box on the page. */
import { program } from './gl.js';
import { breath, BREATHE_GLSL, fitBox } from './breath.js';

const VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in float aCls;
uniform vec2 uRes, uC; uniform float uS, uB; uniform vec3 uSize;
out vec3 vN; out vec3 vP; out float vCls;
${BREATHE_GLSL}
void main(){
  vec3 p = breathe(aPos, uB, uSize);
  gl_Position = vec4((uC.x + p.x*uS)/uRes.x*2. - 1., 1. - (uC.y - p.y*uS)/uRes.y*2., -p.z/400., 1.);
  vN = aNrm; vP = aPos; vCls = aCls;
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vP; in float vCls;
uniform float uPass, uB, uFreq;
out vec4 o;
void main(){
  bool bronchus = vCls > .5;
  if (uPass < 1.5 && bronchus) discard;                       // the first two passes are the surface alone
  if (uPass > 1.5 && !bronchus) discard;
  if (uPass < .5) { o = vec4(0., 0., 0., 1.); return; }       // solid: what is behind the lungs stays hidden
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float ndl = clamp(dot(n, normalize(vec3(-.45, .55, .7))), 0., 1.), rim = pow(1. - clamp(n.z, 0., 1.), 2.2);
  float coord = vP.y*uFreq, f = abs(fract(coord) - .5)*2., w = fwidth(coord)*1.6;
  float thick = bronchus ? .32 : mix(.05, .58, ndl*ndl);      // the engraver's line swells in the light
  float line = 1. - smoothstep(thick - w, thick + w, f);
  float c2 = dot(vP, normalize(vec3(1., 1., 0.)))*uFreq, f2 = abs(fract(c2) - .5)*2., w2 = fwidth(c2)*1.6;
  float hatch = (1. - smoothstep(.12 - w2, .12 + w2, f2))*smoothstep(.7, .95, ndl);   // a crossing set, only in full light
  float I = max(line, hatch*.7)*(.25 + .75*ndl) + rim*.55;
  vec3 col = vec3(1., .14, .2);
  if (bronchus) { I = line*(.5 + .5*ndl)*.45; col = vec3(1., .42, .42); }   // finer and paler, seen through the lung
  I *= .9 + .15*uB;                                           // a little brighter full of air
  o = vec4(col*I, 0.);
}`;

export function createLungs(canvas, mesh, json, { preserve = false, box = canvas } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;
  const pr = program(gl, VS, FS); if (!pr) return null;
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const attr = (name, data, size, type, norm) => { const loc = pr.a(name); if (loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
  attr('aPos', mesh.pos, 3, gl.FLOAT, false); attr('aNrm', mesh.nrm, 3, gl.BYTE, true); attr('aCls', mesh.cls, 1, gl.UNSIGNED_BYTE, false);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const count = mesh.index.length;
  let vw = 0, vh = 0, sc = 1;
  const clear = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
  return {
    gl,
    size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = r.width; vh = r.height; sc = Math.min(dpr, Math.sqrt(7e6 / Math.max(1, vw * vh)));
      const W = Math.max(2, Math.round(vw * sc)), H = Math.max(2, Math.round(vh * sc));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    },
    clear,
    draw(t, fixed = {}) {
      const time = fixed.age != null ? fixed.age : t, b = breath(time), fit = fitBox(box.getBoundingClientRect(), json.size, sc);
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(pr.p); gl.bindVertexArray(vao);
      const u = pr.u;
      gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform2f(u.uC, fit.cx, fit.cy); gl.uniform1f(u.uS, fit.s); gl.uniform1f(u.uB, b); gl.uniform3fv(u.uSize, json.size);
      gl.uniform1f(u.uFreq, Math.min(0.5, Math.max(0.16, fit.s / 9)));   // lines per mm: about nine device px apart, some seventy across the lungs' height
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
      gl.uniform1f(u.uPass, 0); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(false); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform1f(u.uPass, 1); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
      gl.disable(gl.DEPTH_TEST); gl.uniform1f(u.uPass, 2); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);   // the bronchi, through the lung
      gl.bindVertexArray(null);
    },
  };
}
